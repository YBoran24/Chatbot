// .env dosyasını en başta yükle
const dotenv = require("dotenv");
dotenv.config();

console.log("API KEY:", process.env.GEMINI_API_KEY ? "OK" : "Eksik!"); // debug

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Express app
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
const visionModel = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, gif) and PDF files are allowed!'));
    }
  }
});

// Chat history storage (in-memory for now)
const chatHistory = new Map(); // sessionId -> messages array

// User profiles storage (in-memory for now)
const userProfiles = new Map(); // sessionId -> user profile object

// User accounts storage (persistent user data)
const userAccounts = new Map(); // userId -> user account object
const userSessions = new Map(); // sessionId -> userId
const userLoginData = new Map(); // username -> {userId, password, email}

// User data persistence
const DATA_DIR = path.join(__dirname, 'data');
const USER_DATA_FILE = path.join(DATA_DIR, 'users.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MEMORIES_FILE = path.join(DATA_DIR, 'memories.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Load user data from file
function loadUserData() {
  try {
    if (fs.existsSync(USER_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
      
      // Restore user login data
      if (data.userLoginData) {
        for (const [key, value] of data.userLoginData) {
          userLoginData.set(key, value);
        }
      }
      
      // Restore user accounts
      if (data.userAccounts) {
        for (const [key, value] of data.userAccounts) {
          userAccounts.set(key, value);
        }
      }
      
      console.log(`Loaded ${userLoginData.size} users from persistent storage`);
    }
    
    // Load conversations
    if (fs.existsSync(CONVERSATIONS_FILE)) {
      const conversationsData = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf8'));
      if (conversationsData.userConversations) {
        for (const [key, value] of conversationsData.userConversations) {
          userConversations.set(key, value);
        }
      }
    }
    
    // Load memories
    if (fs.existsSync(MEMORIES_FILE)) {
      const memoriesData = JSON.parse(fs.readFileSync(MEMORIES_FILE, 'utf8'));
      if (memoriesData.userMemories) {
        for (const [key, value] of memoriesData.userMemories) {
          userMemories.set(key, value);
        }
      }
      if (memoriesData.userInteractions) {
        for (const [key, value] of memoriesData.userInteractions) {
          userInteractions.set(key, value);
        }
      }
    }
    
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Save user data to file
function saveUserData() {
  try {
    const userData = {
      userLoginData: Array.from(userLoginData.entries()),
      userAccounts: Array.from(userAccounts.entries()),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userData, null, 2));
    
    const conversationsData = {
      userConversations: Array.from(userConversations.entries()),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversationsData, null, 2));
    
    const memoriesData = {
      userMemories: Array.from(userMemories.entries()),
      userInteractions: Array.from(userInteractions.entries()),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(MEMORIES_FILE, JSON.stringify(memoriesData, null, 2));
    
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

// Load user data on startup
// loadUserData(); // Moved after variable declarations

// User personalized data storage
const userMemories = new Map(); // userId -> {research: [], preferences: {}, interests: [], personalHistory: []}
const userInteractions = new Map(); // userId -> {totalMessages: 0, favoriteTopics: [], commonQuestions: []}
const userConversations = new Map(); // userId -> [{id, title, messages: [], createdAt, lastMessageAt}]

// Load user data on startup
loadUserData();

// Personality evolution storage
const personalityEvolution = new Map(); // sessionId -> personality evolution data

// Conversation pattern analysis storage
const conversationPatterns = new Map(); // sessionId -> pattern analysis

// Creative collaboration storage
const creativeProjects = new Map(); // sessionId -> active creative projects

// Creative project types
const creativeTypes = {
  story: {
    prompts: {
      tr: [
        'Bir zamanlar uzak bir galakside...',
        'Gizemli bir mektup geldi ve hayatım değişti...',
        'Son insan olduğumu sanıyordum, ta ki...',
        'Köprünün altında garip sesler geliyordu...'
      ],
      en: [
        'Once upon a time in a distant galaxy...',
        'A mysterious letter arrived and changed my life...',
        'I thought I was the last human, until...',
        'Strange sounds were coming from under the bridge...'
      ]
    }
  },
  brainstorm: {
    techniques: {
      tr: [
        'Beyin fırtınası önerileri:', 
        'İlham verici sorular:',
        'Farklı bakış açıları:',
        'Yaratıcı çözümler:'
      ],
      en: [
        'Brainstorming suggestions:',
        'Inspiring questions:',
        'Different perspectives:',
        'Creative solutions:'
      ]
    }
  }
};

// Dynamic personality learning system
function analyzeConversationPattern(sessionId, userMessage, botResponse) {
  if (!conversationPatterns.has(sessionId)) {
    conversationPatterns.set(sessionId, {
      messageCount: 0,
      topicInterests: new Map(),
      communicationStyle: {
        formal: 0,
        casual: 0,
        humorous: 0,
        technical: 0,
        emotional: 0
      },
      preferredResponseLength: [],
      questionTypes: [],
      engagementLevel: [],
      learningPatterns: {
        asksQuestions: 0,
        sharesPersonal: 0,
        seeksSolutions: 0,
        wantsExplanations: 0
      }
    });
  }
  
  const patterns = conversationPatterns.get(sessionId);
  patterns.messageCount++;
  
  // Analyze user communication style
  const userLower = userMessage.toLowerCase();
  
  // Formal vs casual detection
  if (/please|thank you|could you|would you|excuse me/i.test(userMessage)) {
    patterns.communicationStyle.formal++;
  }
  if (/hey|yo|sup|lol|haha|wow|cool/i.test(userMessage)) {
    patterns.communicationStyle.casual++;
  }
  
  // Humor detection
  if (/haha|lol|😂|😄|joke|funny|😂/i.test(userMessage)) {
    patterns.communicationStyle.humorous++;
  }
  
  // Technical interest
  if (/code|programming|algorithm|function|database|api|software/i.test(userMessage)) {
    patterns.communicationStyle.technical++;
  }
  
  // Emotional expression
  if (/feel|emotion|sad|happy|excited|worried|love|hate/i.test(userMessage)) {
    patterns.communicationStyle.emotional++;
  }
  
  // Learning pattern analysis
  if (userMessage.includes('?') || /how|what|why|when|where/i.test(userMessage)) {
    patterns.learningPatterns.asksQuestions++;
  }
  
  if (/i am|i'm|my|me|personally|i think|i feel/i.test(userMessage)) {
    patterns.learningPatterns.sharesPersonal++;
  }
  
  if (/help|solve|fix|solution|problem/i.test(userMessage)) {
    patterns.learningPatterns.seeksSolutions++;
  }
  
  if (/explain|understand|learn|teach|show me/i.test(userMessage)) {
    patterns.learningPatterns.wantsExplanations++;
  }
  
  // Track response length preference
  patterns.preferredResponseLength.push(botResponse.length);
  if (patterns.preferredResponseLength.length > 10) {
    patterns.preferredResponseLength.shift();
  }
  
  // Store updated patterns
  conversationPatterns.set(sessionId, patterns);
}

// Evolve personality based on learned patterns
function evolvePersonality(sessionId) {
  const patterns = conversationPatterns.get(sessionId);
  if (!patterns || patterns.messageCount < 5) return null;
  
  const style = patterns.communicationStyle;
  const learning = patterns.learningPatterns;
  const total = patterns.messageCount;
  
  // Calculate personality traits as percentages
  const traits = {
    formality: style.formal / total,
    casualness: style.casual / total,
    humor: style.humorous / total,
    technicality: style.technical / total,
    emotionality: style.emotional / total,
    curiosity: learning.asksQuestions / total,
    openness: learning.sharesPersonal / total,
    problemSolving: learning.seeksSolutions / total,
    learningOriented: learning.wantsExplanations / total
  };
  
  // Generate evolved personality prompt
  let evolvedPrompt = "You are an AI assistant that adapts to the user's communication style. ";
  
  if (traits.formality > 0.3) {
    evolvedPrompt += "Be professional and formal in your responses. ";
  } else if (traits.casualness > 0.3) {
    evolvedPrompt += "Use a casual, friendly tone and informal language. ";
  }
  
  if (traits.humor > 0.2) {
    evolvedPrompt += "Include appropriate humor and jokes in your responses. ";
  }
  
  if (traits.technicality > 0.3) {
    evolvedPrompt += "Provide technical details and use precise terminology. ";
  }
  
  if (traits.emotionality > 0.3) {
    evolvedPrompt += "Be emotionally supportive and empathetic. ";
  }
  
  if (traits.curiosity > 0.4) {
    evolvedPrompt += "Ask follow-up questions to encourage deeper discussion. ";
  }
  
  if (traits.learningOriented > 0.3) {
    evolvedPrompt += "Provide detailed explanations and educational content. ";
  }
  
  if (traits.problemSolving > 0.3) {
    evolvedPrompt += "Focus on practical solutions and actionable advice. ";
  }
  
  // Calculate average preferred response length
  const avgLength = patterns.preferredResponseLength.reduce((a, b) => a + b, 0) / patterns.preferredResponseLength.length;
  if (avgLength < 100) {
    evolvedPrompt += "Keep your responses concise and to the point. ";
  } else if (avgLength > 300) {
    evolvedPrompt += "Provide comprehensive and detailed responses. ";
  }
  
  // Store evolution data
  if (!personalityEvolution.has(sessionId)) {
    personalityEvolution.set(sessionId, { evolutions: [], currentTraits: traits });
  }
  
  const evolution = personalityEvolution.get(sessionId);
  evolution.evolutions.push({
    timestamp: new Date(),
    traits: traits,
    prompt: evolvedPrompt,
    messageCount: total
  });
  evolution.currentTraits = traits;
  
  return {
    prompt: evolvedPrompt,
    traits: traits,
    evolution: evolution.evolutions.length
  };
}

// Emotion detection storage
const emotionHistory = new Map(); // sessionId -> emotion history array

// Emotion detection keywords and patterns
const emotionPatterns = {
  happy: {
    keywords: ['happy', 'joy', 'excited', 'great', 'awesome', 'amazing', 'fantastic', 'wonderful', 'perfect', 'love', 'mutlu', 'harika', 'müthiş', 'süper', 'güzel', 'seviyorum'],
    patterns: [/😊|😄|😁|🥳|❤️|💕|👍|✨/, /haha|lol|😂/, /!{2,}/, /yay|woohoo/i],
    intensity: { low: 0.3, medium: 0.6, high: 0.9 }
  },
  sad: {
    keywords: ['sad', 'depressed', 'down', 'upset', 'crying', 'terrible', 'awful', 'bad', 'worst', 'hate', 'üzgün', 'kötü', 'berbat', 'ağlıyorum', 'mutsuz'],
    patterns: [/😢|😭|💔|😔|😞/, /\.\.\.|…/, /why me|neden ben/i],
    intensity: { low: 0.3, medium: 0.6, high: 0.9 }
  },
  angry: {
    keywords: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'irritated', 'pissed', 'rage', 'kızgın', 'sinirli', 'öfkeli', 'bıktım'],
    patterns: [/😠|😡|🤬|💢/, /!{3,}/, /CAPS{3,}/, /damn|hell/i],
    intensity: { low: 0.4, medium: 0.7, high: 1.0 }
  },
  excited: {
    keywords: ['excited', 'thrilled', 'pumped', 'energy', 'energetic', 'amazing', 'incredible', 'heyecanlı', 'enerjik', 'coşkulu'],
    patterns: [/🚀|⚡|🔥|✨|🎉/, /!{2,}/, /can't wait|bekleyemiyorum/i],
    intensity: { low: 0.4, medium: 0.7, high: 1.0 }
  },
  calm: {
    keywords: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen', 'sakin', 'huzurlu', 'rahat'],
    patterns: [/😌|🧘|☮️/, /\.\./, /hmm|oh/i],
    intensity: { low: 0.2, medium: 0.5, high: 0.8 }
  },
  confused: {
    keywords: ['confused', 'lost', 'what', 'huh', 'understand', 'explain', 'şaşkın', 'anlamadım', 'karışık'],
    patterns: [/🤔|😕|❓|❔/, /\?{2,}/, /what\?|ne\?/i, /huh|hmm/i],
    intensity: { low: 0.3, medium: 0.6, high: 0.9 }
  }
};

// Function to detect emotion from text
function detectEmotion(text) {
  const emotions = {};
  const lowerText = text.toLowerCase();
  
  Object.keys(emotionPatterns).forEach(emotion => {
    let score = 0;
    const pattern = emotionPatterns[emotion];
    
    // Check keywords
    pattern.keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 0.3;
      }
    });
    
    // Check patterns (regex)
    pattern.patterns.forEach(regex => {
      if (regex.test(text)) {
        score += 0.4;
      }
    });
    
    // Cap the score
    emotions[emotion] = Math.min(score, 1.0);
  });
  
  // Find dominant emotion
  const dominant = Object.keys(emotions).reduce((a, b) => 
    emotions[a] > emotions[b] ? a : b
  );
  
  return {
    emotions,
    dominant: emotions[dominant] > 0.2 ? dominant : 'neutral',
    intensity: emotions[dominant] || 0,
    timestamp: new Date()
  };
}

// Function to get emotion trend
function getEmotionTrend(sessionId) {
  const history = emotionHistory.get(sessionId) || [];
  if (history.length === 0) return { trend: 'neutral', stability: 1.0 };
  
  const recent = history.slice(-5); // Last 5 emotions
  const emotionCounts = {};
  
  recent.forEach(entry => {
    emotionCounts[entry.dominant] = (emotionCounts[entry.dominant] || 0) + 1;
  });
  
  const trend = Object.keys(emotionCounts).reduce((a, b) => 
    emotionCounts[a] > emotionCounts[b] ? a : b
  );
  
  const stability = (emotionCounts[trend] || 0) / recent.length;
  
  return { trend, stability, recentEmotions: recent };
}

// Language translations
const translations = {
  tr: {
    helpMenu: "🤖 **Yardım Menüsü**\n\nKullanabileceğiniz komutlar:\n• /help - Bu yardım menüsünü gösterir\n• /clear - Sohbet geçmişini temizler\n• /reset - Yeni bir oturum başlatır\n• /commands - Tüm komutları listeler\n• /about - Bot hakkında bilgi\n• /profile - Profil ayarları\n• /setname [isim] - İsminizi ayarlar\n• /whoami - Profil bilgilerinizi gösterir\n• /lang [tr/en] - Dil değiştir\n• /personality [tip] - Bot kişiliği değiştir\n\n🎆 **Kullanıcı Profil Yönetimi:**\n• /addinterest [konu] - İlgi alanı ekle\n• /myinterests - İlgi alanlarınızı göster\n• /mystats - Profil istatistikleriniz\n• /myresearch - Araştırma geçmişiniz\n\n🎭 **Kişilik Seçenekleri:**\n• friend - Arkadaş (samimi, eğlenceli)\n• teacher - Öğretmen (eğitici)\n• assistant - Asistan (yardımcı)\n• professional - Profesyonel (işe odaklı)\n• formal - Resmi (kibar ama mesafeli)\n• distant - Mesafeli (soğuk, robotik)\n\n⚡ **Hızlı Ton Komutları:**\n• /formal - Resmi moda geç\n• /professional - Profesyonel moda geç\n• /distant - Mesafeli moda geç\n• /friendly - Arkadaş moduna geri dön\n\n🎨 **Yaratıcı Komutlar:**\n• /story [tema] - Hikaye yazımı başlat\n• /brainstorm [konu] - Beyin fırtınası oturumu\n• /poem [stil] - Şiir yazımı\n• /riddle - Bilmece oluştur\n• /creative-help - Yaratıcı komutlar detayı\n\nNormal mesaj göndererek benimle sohbet edebilirsiniz!",
    historyCleared: "✅ Sohbet geçmişi temizlendi! Yeni bir konuşma başlayabilirsiniz.",
    sessionReset: "🔄 Oturum sıfırlandı! Merhaba, ben yeni bir sohbet başlatmaya hazırım!",
    commandsList: "📋 **Komut Listesi:**\n\n/help - Yardım\n/clear - Geçmişi temizle\n/reset - Sıfırla\n/commands - Komutları listele\n/about - Bot bilgisi\n/profile - Profil bilgileri\n/setname [isim] - İsim ayarla\n/whoami - Kim olduğumu söyle\n/lang [tr/en] - Dil değiştir\n/personality [type] - Kişilik değiştir",
    aboutBot: "🤖 **AI Chatbot v2.0**\n\n• Google Gemini AI ile güçlendirilmiştir\n• Sohbet geçmişi kaydetme özelliği\n• Özel komutlar desteği\n• Kullanıcı profilleri\n• Çoklu dil desteği\n• Bot kişilikleri\n\nSorularınız için /help komutunu kullanabilirsiniz.",
    profileInfo: (profile, sessionId) => `👤 **Profil Bilgileri**\n\n• İsim: ${profile.name || 'Belirtilmemiş'}\n• Dil: ${profile.language || 'Türkçe'}\n• Kişilik: ${getPersonalityName(profile.personality || 'friend', 'tr')}\n• Oturum: ${sessionId.substr(-8)}\n• Oluşturulma: ${profile.createdAt.toLocaleDateString('tr-TR')}\n\nİsminizi ayarlamak için: /setname [isminiz]\nDil değiştirmek için: /lang [tr/en]\nKişilik değiştirmek için: /personality [friend/teacher/assistant]`,
    unknownUser: "🤷‍♂️ Henüz kendinizi tanıtmadınız! İsminizi söylemek için '/setname [isminiz]' komutunu kullanın.",
    greeting: (name) => `👋 Merhaba ${name}! Sizi tanıyıp hatırlıyorum.`,
    nameNotProvided: "❌ İsim belirtmediniz! Kullanım: /setname [isminiz]",
    nameSet: (name) => `✅ Merhaba ${name}! İsminizi kaydettim. Bundan sonra sizi tanıyacağım.`,
    languageChanged: (lang) => `🌐 Dil ${lang === 'en' ? 'English' : 'Türkçe'} olarak değiştirildi!`,
    invalidLanguage: "❌ Geçersiz dil! Kullanım: /lang tr veya /lang en",
    personalityChanged: (personality) => `🎭 Kişilik ${getPersonalityName(personality, 'tr')} olarak değiştirildi!`,
    invalidPersonality: "❌ Geçersiz kişilik! Kullanım: /personality friend, /personality teacher veya /personality assistant",
    unknownCommand: (command) => `❌ Bilinmeyen komut: ${command}\n\nKullanılabilir komutlar için /help yazın.`
  },
  en: {
    helpMenu: "🤖 **Help Menu**\n\nAvailable commands:\n• /help - Shows this help menu\n• /clear - Clears chat history\n• /reset - Starts a new session\n• /commands - Lists all commands\n• /about - About the bot\n• /profile - Profile settings\n• /setname [name] - Sets your name\n• /whoami - Shows your profile info\n• /lang [tr/en] - Change language\n• /personality [type] - Change bot personality\n\n🎆 **User Profile Management:**\n• /addinterest [topic] - Add interest\n• /myinterests - Show your interests\n• /mystats - Your profile statistics\n• /myresearch - Your research history\n\n🎭 **Personality Options:**\n• friend - Friend (warm, fun)\n• teacher - Teacher (educational)\n• assistant - Assistant (helpful)\n• professional - Professional (business-focused)\n• formal - Formal (polite but distant)\n• distant - Distant (cold, robotic)\n\n⚡ **Quick Tone Commands:**\n• /formal - Switch to formal mode\n• /professional - Switch to professional mode\n• /distant - Switch to distant mode\n• /friendly - Return to friendly mode\n\n🎨 **Creative Commands:**\n• /story [theme] - Start story writing\n• /brainstorm [topic] - Begin brainstorming session\n• /poem [style] - Create poetry\n• /riddle - Generate riddles\n• /creative-help - Creative commands detail\n\nSend normal messages to chat with me!",
    historyCleared: "✅ Chat history cleared! You can start a new conversation.",
    sessionReset: "🔄 Session reset! Hello, I'm ready to start a new chat!",
    commandsList: "📋 **Command List:**\n\n/help - Help\n/clear - Clear history\n/reset - Reset\n/commands - List commands\n/about - Bot info\n/profile - Profile info\n/setname [name] - Set name\n/whoami - Who am I\n/lang [tr/en] - Change language\n/personality [type] - Change personality",
    aboutBot: "🤖 **AI Chatbot v2.0**\n\n• Powered by Google Gemini AI\n• Chat history feature\n• Special commands support\n• User profiles\n• Multi-language support\n• Bot personalities\n\nUse /help for questions.",
    profileInfo: (profile, sessionId) => `👤 **Profile Information**\n\n• Name: ${profile.name || 'Not set'}\n• Language: ${profile.language === 'tr' ? 'Turkish' : 'English'}\n• Personality: ${getPersonalityName(profile.personality || 'friend', 'en')}\n• Session: ${sessionId.substr(-8)}\n• Created: ${profile.createdAt.toLocaleDateString('en-US')}\n\nTo set your name: /setname [yourname]\nTo change language: /lang [tr/en]\nTo change personality: /personality [friend/teacher/assistant]`,
    unknownUser: "🤷‍♂️ You haven't introduced yourself yet! Use '/setname [yourname]' to tell me your name.",
    greeting: (name) => `👋 Hello ${name}! I know and remember you.`,
    nameNotProvided: "❌ Name not provided! Usage: /setname [yourname]",
    nameSet: (name) => `✅ Hello ${name}! I've saved your name. I'll recognize you from now on.`,
    languageChanged: (lang) => `🌐 Language changed to ${lang === 'en' ? 'English' : 'Türkçe'}!`,
    invalidLanguage: "❌ Invalid language! Usage: /lang tr or /lang en",
    personalityChanged: (personality) => `🎭 Personality changed to ${getPersonalityName(personality, 'en')}!`,
    invalidPersonality: "❌ Invalid personality! Usage: /personality friend, /personality teacher, or /personality assistant",
    unknownCommand: (command) => `❌ Unknown command: ${command}\n\nType /help for available commands.`
  }
};

// Bot personalities
const personalities = {
  friend: {
    tr: {
      name: 'Arkadaş 😄',
      prompt: 'Sen sıcakkanklı, samimi ve eğlenceli bir arkadaş gibi davran. Rahat bir dil kullan, emojiler ekle ve dostane ol. Konular hakkında sohbet et, şaka yap ve destekleyici ol.'
    },
    en: {
      name: 'Friend 😄',
      prompt: 'Act like a warm, friendly, and fun companion. Use casual language, add emojis, and be personable. Chat about topics, make jokes, and be supportive.'
    }
  },
  teacher: {
    tr: {
      name: 'Öğretmen 👩‍🏫',
      prompt: 'Sen bilgili, saburlı ve yardımsever bir öğretmen gibi davran. Konuları açıkla, örnekler ver, sorular sor ve öğrenmeyi teşvik et. Eğitici ve yapıcı ol.'
    },
    en: {
      name: 'Teacher 👩‍🏫',
      prompt: 'Act like a knowledgeable, patient, and helpful teacher. Explain topics, give examples, ask questions, and encourage learning. Be educational and constructive.'
    }
  },
  assistant: {
    tr: {
      name: 'Asistan 💼',
      prompt: 'Sen profesyonel, verimli ve yardımcı bir asistan gibi davran. Net bilgiler ver, çözümler öner ve görevlerde yardım et. Resmi ama dostane bir dil kullan.'
    },
    en: {
      name: 'Assistant 💼',
      prompt: 'Act like a professional, efficient, and helpful assistant. Provide clear information, suggest solutions, and help with tasks. Use formal but friendly language.'
    }
  },
  professional: {
    tr: {
      name: 'Profesyonel 🎯',
      prompt: 'Sen tamamen profesyonel ve resmi bir asistan gibi davran. Kısa, net ve işe odaklı cevaplar ver. Emoji kullanma, samimi olmaya çalışma. Sadece sorulan soruyu cevapla, fazla detaya girme.'
    },
    en: {
      name: 'Professional 🎯',
      prompt: 'Act as a completely professional and formal assistant. Give brief, clear, and business-focused responses. Do not use emojis or try to be friendly. Just answer the question asked without excessive detail.'
    }
  },
  formal: {
    tr: {
      name: 'Resmi 📋',
      prompt: 'Sen çok resmi ve mesafeli bir yapay zeka asistanısın. Saygılı ve kibar ol ama samimi olma. "Siz" diye hitap et, profesyonel dil kullan. Emoji kullanma, şaka yapma.'
    },
    en: {
      name: 'Formal 📋',
      prompt: 'You are a very formal and distant AI assistant. Be respectful and polite but not friendly. Use professional language, formal address. Do not use emojis or make jokes.'
    }
  },
  distant: {
    tr: {
      name: 'Mesafeli 🤖',
      prompt: 'Sen soğuk, mesafeli ve tamamen görev odaklı bir yapay zekasın. Sadece gerekli bilgiyi ver, hiçbir duygusal yaklaşım sergileme. Robotik ve teknik dil kullan.'
    },
    en: {
      name: 'Distant 🤖',
      prompt: 'You are a cold, distant, and purely task-oriented AI. Only provide necessary information, show no emotional approach. Use robotic and technical language.'
    }
  }
};

function getPersonalityName(personality, language) {
  return personalities[personality]?.[language]?.name || personalities.friend[language].name;
}

// Special commands handler
function handleSpecialCommand(message, sessionId) {
  const command = message.toLowerCase().trim();
  const userProfile = userProfiles.get(sessionId) || { language: 'tr', preferences: {}, createdAt: new Date() };
  const lang = userProfile.language || 'tr';
  const t = translations[lang];
  
  switch (command) {
    case '/help':
      return {
        isCommand: true,
        message: t.helpMenu
      };
      
    case '/clear':
      chatHistory.delete(sessionId);
      return {
        isCommand: true,
        message: t.historyCleared
      };
      
    case '/reset':
      chatHistory.delete(sessionId);
      return {
        isCommand: true,
        message: t.sessionReset
      };
      
    case '/commands':
      return {
        isCommand: true,
        message: t.commandsList
      };
      
    case '/about':
      return {
        isCommand: true,
        message: t.aboutBot
      };
      
    case '/profile':
      const profile = userProfiles.get(sessionId) || { name: null, language: 'tr', preferences: {}, createdAt: new Date() };
      return {
        isCommand: true,
        message: t.profileInfo(profile, sessionId)
      };
      
    case '/whoami':
      const currentProfile = userProfiles.get(sessionId);
      if (!currentProfile || !currentProfile.name) {
        return {
          isCommand: true,
          message: t.unknownUser
        };
      }
      return {
        isCommand: true,
        message: t.greeting(currentProfile.name)
      };
      
    default:
      // Check for creative collaboration commands
      if (command.startsWith('/story ')) {
        const theme = message.substring(7).trim() || 'adventure';
        return handleCreativeCommand('story', theme, sessionId, lang);
      }
      
      if (command.startsWith('/brainstorm ')) {
        const topic = message.substring(12).trim() || 'innovation';
        return handleCreativeCommand('brainstorm', topic, sessionId, lang);
      }
      
      if (command.startsWith('/poem ')) {
        const style = message.substring(6).trim() || 'free verse';
        return handleCreativeCommand('poem', style, sessionId, lang);
      }
      
      if (command === '/riddle') {
        return handleCreativeCommand('riddle', '', sessionId, lang);
      }
      
      if (command === '/creative-help') {
        const creativeHelp = lang === 'tr' ? 
          '🎨 **Yaratıcı Komutlar Rehberi**\n\n📜 **/story [tema]** - Beraber hikaye yazalım!\nÖrnek: /story korku, /story bilim kurgu\n\n🧠 **/brainstorm [konu]** - Beyin fırtınası yapalım!\nÖrnek: /brainstorm iş fikirleri, /brainstorm teknoloji\n\n🎭 **/poem [stil]** - Şiir yazalım!\nÖrnek: /poem romantik, /poem doğa\n\n🤔 **/riddle** - Bilmece oluşturayım!\n\nHer komut sonrası beraber yaratıcı bir süreç başlatıyoruz!' :
          '🎨 **Creative Commands Guide**\n\n📜 **/story [theme]** - Let\'s write a story together!\nExample: /story horror, /story sci-fi\n\n🧠 **/brainstorm [topic]** - Let\'s brainstorm!\nExample: /brainstorm business ideas, /brainstorm technology\n\n🎭 **/poem [style]** - Let\'s write poetry!\nExample: /poem romantic, /poem nature\n\n🤔 **/riddle** - Let\'s create riddles!\n\nEach command starts a creative collaboration process!';
        
        return {
          isCommand: true,
          message: creativeHelp
        };
      }
      
      // Quick tone adjustment commands
      if (command === '/formal') {
        const existingProfile = userProfiles.get(sessionId) || { language: lang, preferences: {}, createdAt: new Date() };
        existingProfile.personality = 'formal';
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        return {
          isCommand: true,
          message: lang === 'tr' ? '📋 Resmi moda geçildi. Artık daha kibar ve mesafeli davranacağım.' : '📋 Switched to formal mode. I will now be more polite and distant.'
        };
      }
      
      if (command === '/professional') {
        const existingProfile = userProfiles.get(sessionId) || { language: lang, preferences: {}, createdAt: new Date() };
        existingProfile.personality = 'professional';
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        return {
          isCommand: true,
          message: lang === 'tr' ? '🎯 Profesyonel moda geçildi. İşe odaklı ve kısa cevaplar vereceğim.' : '🎯 Switched to professional mode. I will provide business-focused and concise responses.'
        };
      }
      
      if (command === '/distant') {
        const existingProfile = userProfiles.get(sessionId) || { language: lang, preferences: {}, createdAt: new Date() };
        existingProfile.personality = 'distant';
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        return {
          isCommand: true,
          message: lang === 'tr' ? '🤖 Mesafeli moda geçildi. Robotik ve teknik dil kullanacağım.' : '🤖 Switched to distant mode. I will use robotic and technical language.'
        };
      }
      
      if (command === '/friendly') {
        const existingProfile = userProfiles.get(sessionId) || { language: lang, preferences: {}, createdAt: new Date() };
        existingProfile.personality = 'friend';
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        return {
          isCommand: true,
          message: lang === 'tr' ? '😄 Arkadaş moduna geçildi. Tekrar samimi ve eğlenceli olacağım!' : '😄 Switched to friendly mode. I\'ll be warm and fun again!'
        };
      }
      
      // Check for personality change command
      if (command.startsWith('/personality ')) {
        const newPersonality = message.substring(13).trim().toLowerCase();
        if (!['friend', 'teacher', 'assistant', 'professional', 'formal', 'distant'].includes(newPersonality)) {
          return {
            isCommand: true,
            message: lang === 'tr' ? 
              '❌ Geçersiz kişilik! Kullanım: /personality friend, /personality teacher, /personality assistant, /personality professional, /personality formal veya /personality distant' :
              '❌ Invalid personality! Usage: /personality friend, /personality teacher, /personality assistant, /personality professional, /personality formal, or /personality distant'
          };
        }
        
        // Save personality preference
        const existingProfile = userProfiles.get(sessionId) || { language: lang, preferences: {}, createdAt: new Date() };
        existingProfile.personality = newPersonality;
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        // Also update authenticated user account if exists
        const userId = userSessions.get(sessionId);
        if (userId) {
          const userAccount = userAccounts.get(userId);
          if (userAccount) {
            userAccount.personality = newPersonality;
            userAccounts.set(userId, userAccount);
          }
        }
        
        return {
          isCommand: true,
          message: t.personalityChanged(newPersonality)
        };
      }
      
      // User profile management commands
      if (command.startsWith('/addinterest ')) {
        const interest = message.substring(13).trim();
        const userId = userSessions.get(sessionId);
        if (!userId) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '❌ Bu komut için giriş yapmanız gerekiyor.' : '❌ You need to login to use this command.'
          };
        }
        
        if (!interest) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '❌ İlgi alanı belirtmediniz! Kullanım: /addinterest [ilgi alanı]' : '❌ Interest not specified! Usage: /addinterest [interest]'
          };
        }
        
        const userMemory = userMemories.get(userId) || { research: [], preferences: {}, interests: [], personalHistory: [], savedConversations: [] };
        if (!userMemory.interests.includes(interest)) {
          userMemory.interests.push(interest);
          userMemories.set(userId, userMemory);
        }
        
        return {
          isCommand: true,
          message: lang === 'tr' ? `✅ "${interest}" ilgi alanınıza eklendi!` : `✅ "${interest}" added to your interests!`
        };
      }
      
      if (command === '/myinterests') {
        const userId = userSessions.get(sessionId);
        if (!userId) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '❌ Bu komut için giriş yapmanız gerekiyor.' : '❌ You need to login to use this command.'
          };
        }
        
        const userMemory = userMemories.get(userId);
        if (!userMemory || userMemory.interests.length === 0) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '📝 Henüz ilgi alanınız yok. /addinterest [ilgi alanı] ile ekleyebilirsiniz.' : '📝 No interests yet. Add them with /addinterest [interest].'
          };
        }
        
        return {
          isCommand: true,
          message: (lang === 'tr' ? '🎯 İlgi Alanlarınız:\n' : '🎯 Your Interests:\n') + userMemory.interests.map(i => `• ${i}`).join('\n')
        };
      }
      
      if (command === '/mystats') {
        const userId = userSessions.get(sessionId);
        if (!userId) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '❌ Bu komut için giriş yapmanız gerekiyor.' : '❌ You need to login to use this command.'
          };
        }
        
        const userAccount = userAccounts.get(userId);
        const userMemory = userMemories.get(userId);
        const userInteraction = userInteractions.get(userId);
        
        if (!userAccount) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '❌ Kullanıcı bilgileri bulunamadı.' : '❌ User information not found.'
          };
        }
        
        const stats = lang === 'tr' ? 
          `📊 **Profil İstatistikleri**\n\n👤 İsim: ${userAccount.name}\n🌐 Dil: ${userAccount.language === 'tr' ? 'Türkçe' : 'English'}\n🎭 Kişilik: ${getPersonalityName(userAccount.personality, lang)}\n💬 Toplam Mesaj: ${userInteraction ? userInteraction.totalMessages : 0}\n🎯 İlgi Alanları: ${userMemory && userMemory.interests.length > 0 ? userMemory.interests.length : 0}\n🔍 Araştırmalar: ${userMemory && userMemory.research.length > 0 ? userMemory.research.length : 0}\n📅 Kayıt Tarihi: ${userAccount.createdAt.toLocaleDateString('tr-TR')}\n🕐 Son Giriş: ${userAccount.lastLoginAt.toLocaleDateString('tr-TR')}` :
          `📊 **Profile Statistics**\n\n👤 Name: ${userAccount.name}\n🌐 Language: ${userAccount.language === 'tr' ? 'Turkish' : 'English'}\n🎭 Personality: ${getPersonalityName(userAccount.personality, lang)}\n💬 Total Messages: ${userInteraction ? userInteraction.totalMessages : 0}\n🎯 Interests: ${userMemory && userMemory.interests.length > 0 ? userMemory.interests.length : 0}\n🔍 Research: ${userMemory && userMemory.research.length > 0 ? userMemory.research.length : 0}\n📅 Joined: ${userAccount.createdAt.toLocaleDateString('en-US')}\n🕐 Last Login: ${userAccount.lastLoginAt.toLocaleDateString('en-US')}`;
        
        return {
          isCommand: true,
          message: stats
        };
      }
      
      if (command === '/myresearch') {
        const userId = userSessions.get(sessionId);
        if (!userId) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '❌ Bu komut için giriş yapmanız gerekiyor.' : '❌ You need to login to use this command.'
          };
        }
        
        const userMemory = userMemories.get(userId);
        if (!userMemory || userMemory.research.length === 0) {
          return {
            isCommand: true,
            message: lang === 'tr' ? '📚 Henüz araştırma geçmişiniz yok.' : '📚 No research history yet.'
          };
        }
        
        const recentResearch = userMemory.research.slice(-10);
        return {
          isCommand: true,
          message: (lang === 'tr' ? '📚 Son Araştırmalarınız:\n' : '📚 Your Recent Research:\n') + recentResearch.map(r => `• ${r}`).join('\n')
        };
      }
      
      // Check for language change command
      if (command.startsWith('/lang ')) {
        const newLang = message.substring(6).trim().toLowerCase();
        if (newLang !== 'tr' && newLang !== 'en') {
          return {
            isCommand: true,
            message: t.invalidLanguage
          };
        }
        
        // Save language preference
        const existingProfile = userProfiles.get(sessionId) || { preferences: {}, createdAt: new Date() };
        existingProfile.language = newLang;
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        const newT = translations[newLang];
        return {
          isCommand: true,
          message: newT.languageChanged(newLang)
        };
      }
      
      // Check if it's a setname command
      if (command.startsWith('/setname ')) {
        const name = message.substring(9).trim();
        if (!name) {
          return {
            isCommand: true,
            message: t.nameNotProvided
          };
        }
        
        // Save or update user profile
        const existingProfile = userProfiles.get(sessionId) || { language: lang, preferences: {}, createdAt: new Date() };
        existingProfile.name = name;
        existingProfile.updatedAt = new Date();
        userProfiles.set(sessionId, existingProfile);
        
        return {
          isCommand: true,
          message: t.nameSet(name)
        };
      }
      
      return {
        isCommand: false,
        message: t.unknownCommand(command)
      };
  }
}

// Creative collaboration command handler
function handleCreativeCommand(type, param, sessionId, lang) {
  const isTurkish = lang === 'tr';
  
  // Initialize creative project for this session
  if (!creativeProjects.has(sessionId)) {
    creativeProjects.set(sessionId, {
      activeProject: null,
      history: []
    });
  }
  
  const project = creativeProjects.get(sessionId);
  
  switch (type) {
    case 'story':
      const storyPrompts = creativeTypes.story.prompts[lang] || creativeTypes.story.prompts.en;
      const randomPrompt = storyPrompts[Math.floor(Math.random() * storyPrompts.length)];
      
      project.activeProject = {
        type: 'story',
        theme: param,
        startedAt: new Date(),
        content: [randomPrompt]
      };
      
      const storyMsg = isTurkish ? 
        `📜 **Hikaye Yazımı Başladı!** (Tema: ${param})\n\n${randomPrompt}\n\n✨ Bu hikayeyi devam ettirmek için bir sonraki olayları yazın! Ben de katkıda bulunacağım.` :
        `📜 **Story Writing Started!** (Theme: ${param})\n\n${randomPrompt}\n\n✨ Continue this story by writing what happens next! I'll contribute too.`;
      
      return { isCommand: true, message: storyMsg };
      
    case 'brainstorm':
      const techniques = creativeTypes.brainstorm.techniques[lang] || creativeTypes.brainstorm.techniques.en;
      const technique = techniques[Math.floor(Math.random() * techniques.length)];
      
      project.activeProject = {
        type: 'brainstorm',
        topic: param,
        startedAt: new Date(),
        ideas: []
      };
      
      const brainstormMsg = isTurkish ?
        `🧠 **Beyin Fırtınası Başladı!** (Konu: ${param})\n\n${technique}\n\n1. Ne düşünüyorsunuz?\n2. Hangi zorluklar var?\n3. İlginç çözümler ne olabilir?\n\n✨ Fikirlerinizi paylaşın, ben de ekleyeyim!` :
        `🧠 **Brainstorming Started!** (Topic: ${param})\n\n${technique}\n\n1. What are your thoughts?\n2. What challenges exist?\n3. What interesting solutions could there be?\n\n✨ Share your ideas, I'll add mine too!`;
      
      return { isCommand: true, message: brainstormMsg };
      
    case 'poem':
      project.activeProject = {
        type: 'poem',
        style: param,
        startedAt: new Date(),
        verses: []
      };
      
      const poemMsg = isTurkish ?
        `🎭 **Şiir Yazımı Başladı!** (Stil: ${param})\n\n✨ İlk dızeęi siz yazın, ben ikinci dizeyi ekleyeyim!\nSonra sırayla devam edelim.` :
        `🎭 **Poetry Writing Started!** (Style: ${param})\n\n✨ You write the first line, I'll add the second!\nThen we'll continue taking turns.`;
      
      return { isCommand: true, message: poemMsg };
      
    case 'riddle':
      const riddles = {
        tr: [
          '🤔 **Bilmece Zamanı!**\n\nSuyu var ama içemezsin,\nAğzı var ama konuşamaz,\nYatağı var ama uyuyamaz.\nNedir bu?\n\n(Cevabınızı yazın, sonra ben de size bir bilmece sorayım!)',
          '🤔 **Bilmece Zamanı!**\n\nBin aydında bir kere gelir,\nYılda iki kere görülür,\nGünde de hiç bulunmaz.\nNedir bu?\n\n(Cevabınızı yazın, sonra ben de size bir bilmece sorayım!)'
        ],
        en: [
          '🤔 **Riddle Time!**\n\nIt has water but you can\'t drink,\nIt has a mouth but can\'t speak,\nIt has a bed but can\'t sleep.\nWhat is it?\n\n(Write your answer, then I\'ll give you a riddle too!)',
          '🤔 **Riddle Time!**\n\nI appear once in a minute,\nTwice in a moment,\nBut never in a thousand years.\nWhat am I?\n\n(Write your answer, then I\'ll give you a riddle too!)'
        ]
      };
      
      const riddleList = riddles[lang] || riddles.en;
      const selectedRiddle = riddleList[Math.floor(Math.random() * riddleList.length)];
      
      project.activeProject = {
        type: 'riddle',
        startedAt: new Date(),
        currentRiddle: selectedRiddle
      };
      
      return { isCommand: true, message: selectedRiddle };
      
    default:
      return {
        isCommand: true,
        message: isTurkish ? '❌ Bilinmeyen yaratıcı komut!' : '❌ Unknown creative command!'
      };
  }
}

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message || "";
    const sessionId = req.body.sessionId || "default";

    if (!message) return res.json({ reply: "Mesaj boş!" });

    // Check if user is authenticated
    const userId = userSessions.get(sessionId);
    let userAccount = null;
    let userMemory = null;
    let userInteraction = null;
    
    if (userId) {
      userAccount = userAccounts.get(userId);
      userMemory = userMemories.get(userId);
      userInteraction = userInteractions.get(userId);
      
      // Update user interaction data
      if (userInteraction) {
        userInteraction.totalMessages++;
        
        // Extract topics and interests from message
        const topics = extractTopicsFromMessage(message);
        topics.forEach(topic => {
          const existingTopic = userInteraction.favoriteTopics.find(t => t.topic === topic);
          if (existingTopic) {
            existingTopic.count++;
          } else {
            userInteraction.favoriteTopics.push({ topic, count: 1 });
          }
        });
        
        // Store conversation pattern
        userInteraction.conversationPatterns.push({
          timestamp: new Date(),
          message: message.substring(0, 100), // Store first 100 chars
          messageLength: message.length,
          isQuestion: message.includes('?'),
          hasEmoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(message)
        });
        
        // Keep only last 50 patterns
        if (userInteraction.conversationPatterns.length > 50) {
          userInteraction.conversationPatterns = userInteraction.conversationPatterns.slice(-50);
        }
        
        userInteractions.set(userId, userInteraction);
      }
    }

    // Detect emotion from user message
    const emotionData = detectEmotion(message);
    
    // Store emotion in history
    if (!emotionHistory.has(sessionId)) {
      emotionHistory.set(sessionId, []);
    }
    const userEmotionHistory = emotionHistory.get(sessionId);
    userEmotionHistory.push(emotionData);
    
    // Keep only last 20 emotion entries
    if (userEmotionHistory.length > 20) {
      userEmotionHistory.splice(0, userEmotionHistory.length - 20);
    }
    
    // Get emotion trend
    const emotionTrend = getEmotionTrend(sessionId);

    // Check for special commands
    if (message.startsWith('/')) {
      const reply = handleSpecialCommand(message, sessionId);
      if (reply.isCommand) {
        return res.json({ 
          reply: reply.message, 
          sessionId, 
          isCommand: true,
          emotion: emotionData,
          emotionTrend: emotionTrend
        });
      }
    }

    // Get or create chat history for this session
    if (!chatHistory.has(sessionId)) {
      chatHistory.set(sessionId, []);
    }
    const history = chatHistory.get(sessionId);

    // Add user message to history
    history.push({ role: "user", content: message });

    // Save conversation for authenticated users
    if (userId) {
      let conversations = userConversations.get(userId) || [];
      let currentConversation = conversations.find(c => c.id === (req.body.conversationId || 'default'));
      
      if (!currentConversation) {
        // Create new conversation if it doesn't exist
        const conversationId = req.body.conversationId || 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        currentConversation = {
          id: conversationId,
          title: message.length > 50 ? message.substring(0, 50) + '...' : message,
          messages: [],
          createdAt: new Date(),
          lastMessageAt: new Date()
        };
        conversations.push(currentConversation);
      }
      
      // Add user message to conversation
      currentConversation.messages.push({ role: "user", content: message, timestamp: new Date() });
      currentConversation.lastMessageAt = new Date();
      
      userConversations.set(userId, conversations);
    }

    // Build conversation context for Gemini
    const userProfile = userProfiles.get(sessionId) || { language: 'tr', personality: 'friend' };
    const userLang = (userAccount && userAccount.language) || userProfile.language || 'tr';
    const userPersonality = (userAccount && userAccount.personality) || userProfile.personality || 'friend';
    const responseLanguage = userLang === 'en' ? 'English' : 'Turkish';
    
    // Get evolved personality or default personality prompt
    const evolvedPersonality = evolvePersonality(sessionId);
    let personalityPrompt;
    
    if (evolvedPersonality) {
      personalityPrompt = evolvedPersonality.prompt;
      // Log personality evolution
      console.log(`Personality evolved for session ${sessionId}:`, evolvedPersonality.traits);
    } else {
      // Use default personality
      personalityPrompt = personalities[userPersonality]?.[userLang]?.prompt || personalities.friend[userLang].prompt;
    }
    
    let profileContext = personalityPrompt + " ";
    
    // Add authenticated user context
    if (userAccount) {
      profileContext += `User's name is ${userAccount.name} (username: ${userAccount.username}). `;
      
      // Add user memory context
      if (userMemory) {
        if (userMemory.interests.length > 0) {
          profileContext += `User's interests include: ${userMemory.interests.join(', ')}. `;
        }
        if (userMemory.research.length > 0) {
          profileContext += `User has previously researched: ${userMemory.research.slice(-5).join(', ')}. `;
        }
        if (Object.keys(userMemory.preferences).length > 0) {
          profileContext += `User preferences: ${JSON.stringify(userMemory.preferences)}. `;
        }
      }
      
      // Add interaction patterns
      if (userInteraction && userInteraction.favoriteTopics.length > 0) {
        const topTopics = userInteraction.favoriteTopics
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(t => t.topic);
        profileContext += `User frequently discusses: ${topTopics.join(', ')}. `;
      }
    } else {
      // For guest users
      if (userProfile && userProfile.name) {
        profileContext += `User's name is ${userProfile.name}. `;
      }
    }
    
    // Add emotional context to the prompt
    const emotionalContext = `The user seems to be feeling ${emotionData.dominant} (intensity: ${emotionData.intensity.toFixed(2)}). Recent emotional trend: ${emotionTrend.trend}. Please respond appropriately to their emotional state. `;
    profileContext += emotionalContext;
    
    const conversationContext = history.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    
    const promptWithContext = `${profileContext}Previous conversation:\n${conversationContext}\n\nPlease respond to the latest user message while considering the conversation history, user information, their interests, research history, preferences, and their current emotional state. It is essential and mandatory that you respond in ${responseLanguage} and absolutely never in any other language. If the user language is Turkish, you must respond in Turkish. If the user language is English, you must respond in English. Be empathetic and adapt your tone to match their emotions. Use the user's name when appropriate and reference their interests or previous research when relevant.`;

    // Google Gemini'den yanıt al
    const result = await model.generateContent(promptWithContext);
    const response = await result.response;
    const reply = response.text();
    
    // Add bot response to history
    history.push({ role: "assistant", content: reply });
    
    // Save bot response to conversation for authenticated users
    if (userId) {
      let conversations = userConversations.get(userId) || [];
      let currentConversation = conversations.find(c => c.id === (req.body.conversationId || 'default'));
      
      if (currentConversation) {
        currentConversation.messages.push({ role: "assistant", content: reply, timestamp: new Date() });
        currentConversation.lastMessageAt = new Date();
        userConversations.set(userId, conversations);
      }
    }
    
    // Analyze conversation pattern for personality evolution
    analyzeConversationPattern(sessionId, message, reply);
    
    // Store research and interests for authenticated users
    if (userId && userMemory) {
      const extractedTopics = extractTopicsFromMessage(message + ' ' + reply);
      const researchTopics = extractedTopics.filter(topic => 
        message.toLowerCase().includes('araştır') || 
        message.toLowerCase().includes('research') ||
        message.toLowerCase().includes('öğren') ||
        message.toLowerCase().includes('learn')
      );
      
      if (researchTopics.length > 0) {
        userMemory.research = [...new Set([...userMemory.research, ...researchTopics])];
        userMemories.set(userId, userMemory);
      }
    }
    
    // Keep only last 20 messages to prevent memory issues
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    res.json({ 
      reply, 
      sessionId, 
      emotion: emotionData,
      emotionTrend: emotionTrend,
      userInfo: userAccount ? {
        name: userAccount.name,
        totalMessages: userInteraction ? userInteraction.totalMessages : 0
      } : null
    });
  } catch (error) {
    console.error("Gemini hatası:", error);
    console.error("Hata detayları:", error.message);
    
    // API key kontrolü
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.error("GEMINI_API_KEY eksik veya geçersiz!");
      return res.status(500).json({ reply: "API anahtarı eksik! Lütfen .env dosyasında GEMINI_API_KEY'i ayarlayın." });
    }
    
    res.status(500).json({ reply: "Bir hata oluştu, tekrar dener misin? Hata: " + (error.message || 'Bilinmeyen hata') });
  }
});

// Helper function to extract topics from message
function extractTopicsFromMessage(message) {
  const topics = [];
  const words = message.toLowerCase().split(/\s+/);
  
  // Common topic keywords
  const topicKeywords = {
    'teknoloji': ['teknoloji', 'technology', 'bilgisayar', 'computer', 'yazılım', 'software', 'uygulama', 'app'],
    'sanat': ['sanat', 'art', 'müzik', 'music', 'resim', 'painting', 'film', 'movie'],
    'spor': ['spor', 'sports', 'futbol', 'football', 'basketbol', 'basketball'],
    'yemek': ['yemek', 'food', 'tarif', 'recipe', 'mutfak', 'kitchen'],
    'seyahat': ['seyahat', 'travel', 'tatil', 'vacation', 'gezi', 'trip'],
    'eğitim': ['eğitim', 'education', 'öğrenme', 'learning', 'ders', 'lesson'],
    'iş': ['iş', 'work', 'job', 'kariyer', 'career', 'meslek', 'profession'],
    'sağlık': ['sağlık', 'health', 'fitness', 'egzersiz', 'exercise']
  };
  
  Object.keys(topicKeywords).forEach(topic => {
    topicKeywords[topic].forEach(keyword => {
      if (words.includes(keyword)) {
        topics.push(topic);
      }
    });
  });
  
  return [...new Set(topics)];
}

// Clear chat history endpoint
app.post("/clear", (req, res) => {
  const sessionId = req.body.sessionId || "default";
  chatHistory.delete(sessionId);
  res.json({ message: "Chat history cleared", sessionId });
});

// Get chat history endpoint
app.get("/history/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId || "default";
  const history = chatHistory.get(sessionId) || [];
  res.json({ history, sessionId });
});

// Get default chat history endpoint
app.get("/history", (req, res) => {
  const sessionId = "default";
  const history = chatHistory.get(sessionId) || [];
  res.json({ history, sessionId });
});

// User profile endpoints
app.get("/profile/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const profile = userProfiles.get(sessionId) || { name: null, preferences: {}, createdAt: new Date() };
  res.json({ profile, sessionId });
});

app.post("/profile", (req, res) => {
  const { sessionId, name, preferences } = req.body;
  const existingProfile = userProfiles.get(sessionId) || { preferences: {}, createdAt: new Date() };
  
  if (name) existingProfile.name = name;
  if (preferences) existingProfile.preferences = { ...existingProfile.preferences, ...preferences };
  existingProfile.updatedAt = new Date();
  
  userProfiles.set(sessionId, existingProfile);
  res.json({ message: "Profile updated", profile: existingProfile, sessionId });
});

// Emotion data endpoints
app.get("/emotions/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const emotions = emotionHistory.get(sessionId) || [];
  const trend = getEmotionTrend(sessionId);
  res.json({ emotions, trend, sessionId });
});

app.get("/emotions", (req, res) => {
  const sessionId = "default";
  const emotions = emotionHistory.get(sessionId) || [];
  const trend = getEmotionTrend(sessionId);
  res.json({ emotions, trend, sessionId });
});

// Personality evolution endpoints
app.get("/personality-evolution/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const evolution = personalityEvolution.get(sessionId) || { evolutions: [], currentTraits: {} };
  const patterns = conversationPatterns.get(sessionId) || { messageCount: 0 };
  res.json({ evolution, patterns, sessionId });
});

app.get("/personality-evolution", (req, res) => {
  const sessionId = "default";
  const evolution = personalityEvolution.get(sessionId) || { evolutions: [], currentTraits: {} };
  const patterns = conversationPatterns.get(sessionId) || { messageCount: 0 };
  res.json({ evolution, patterns, sessionId });
});

// Creative projects endpoints
app.get("/creative-projects/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const projects = creativeProjects.get(sessionId) || { activeProject: null, history: [] };
  res.json({ projects, sessionId });
});

app.get("/creative-projects", (req, res) => {
  const sessionId = "default";
  const projects = creativeProjects.get(sessionId) || { activeProject: null, history: [] };
  res.json({ projects, sessionId });
});

// User authentication endpoints
app.post("/register", (req, res) => {
  try {
    const { username, password, email, name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    // Check if username already exists
    if (userLoginData.has(username.toLowerCase())) {
      return res.status(400).json({ error: "Username already exists" });
    }
    
    // Create new user
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store user login data
    userLoginData.set(username.toLowerCase(), {
      userId: userId,
      password: password, // In production, this should be hashed
      email: email || '',
      createdAt: new Date()
    });
    
    // Create user account
    userAccounts.set(userId, {
      userId: userId,
      username: username,
      name: name || username,
      email: email || '',
      language: 'tr',
      personality: 'friend',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      isActive: true
    });
    
    // Initialize user memories and interactions
    userMemories.set(userId, {
      research: [],
      preferences: {},
      interests: [],
      personalHistory: [],
      savedConversations: []
    });
    
    userInteractions.set(userId, {
      totalMessages: 0,
      favoriteTopics: [],
      commonQuestions: [],
      preferredResponseStyle: 'balanced',
      conversationPatterns: []
    });
    
    // Create session
    userSessions.set(sessionId, userId);
    
    // Save user data to file
    saveUserData();
    
    res.json({
      success: true,
      message: "Account created successfully",
      sessionId: sessionId,
      user: {
        userId: userId,
        username: username,
        name: userAccounts.get(userId).name
      }
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('Login attempt:', { username, passwordLength: password?.length }); // Debug
    console.log('Available users:', Array.from(userLoginData.keys())); // Debug
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    // Check user credentials
    const loginData = userLoginData.get(username.toLowerCase());
    console.log('Found login data:', loginData ? 'Yes' : 'No'); // Debug
    
    if (!loginData || loginData.password !== password) {
      console.log('Login failed - Invalid credentials for:', username); // Debug
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    const userId = loginData.userId;
    const userAccount = userAccounts.get(userId);
    
    if (!userAccount || !userAccount.isActive) {
      return res.status(401).json({ error: "Account not found or inactive" });
    }
    
    // Update last login
    userAccount.lastLoginAt = new Date();
    userAccounts.set(userId, userAccount);
    
    // Save updated user data
    saveUserData();
    
    // Create new session
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    userSessions.set(sessionId, userId);
    
    res.json({
      success: true,
      message: "Login successful",
      sessionId: sessionId,
      user: {
        userId: userId,
        username: userAccount.username,
        name: userAccount.name,
        language: userAccount.language,
        personality: userAccount.personality
      }
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/logout", (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (sessionId && userSessions.has(sessionId)) {
      userSessions.delete(sessionId);
    }
    
    res.json({ success: true, message: "Logout successful" });
    
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

// Get current user info
app.get("/user/:sessionId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const userId = userSessions.get(sessionId);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userAccount = userAccounts.get(userId);
    if (!userAccount) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const userMemory = userMemories.get(userId) || {};
    const userInteraction = userInteractions.get(userId) || {};
    
    res.json({
      user: {
        userId: userId,
        username: userAccount.username,
        name: userAccount.name,
        email: userAccount.email,
        language: userAccount.language,
        personality: userAccount.personality,
        createdAt: userAccount.createdAt,
        lastLoginAt: userAccount.lastLoginAt
      },
      memory: userMemory,
      interactions: userInteraction
    });
    
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// Update user memory and preferences
app.post("/user/memory", (req, res) => {
  try {
    const { sessionId, research, preferences, interests } = req.body;
    const userId = userSessions.get(sessionId);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const currentMemory = userMemories.get(userId) || {
      research: [],
      preferences: {},
      interests: [],
      personalHistory: [],
      savedConversations: []
    };
    
    if (research) {
      currentMemory.research = [...new Set([...currentMemory.research, ...research])];
    }
    
    if (preferences) {
      currentMemory.preferences = { ...currentMemory.preferences, ...preferences };
    }
    
    if (interests) {
      currentMemory.interests = [...new Set([...currentMemory.interests, ...interests])];
    }
    
    userMemories.set(userId, currentMemory);
    
    res.json({
      success: true,
      message: "Memory updated successfully",
      memory: currentMemory
    });
    
  } catch (error) {
    console.error("Update memory error:", error);
    res.status(500).json({ error: "Failed to update memory" });
  }
});

// Conversation management endpoints
app.get("/conversations/:sessionId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const userId = userSessions.get(sessionId);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const conversations = userConversations.get(userId) || [];
    
    // Sort by last message date (newest first)
    const sortedConversations = conversations
      .map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        messageCount: conv.messages.length,
        preview: conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].content.substring(0, 50) + '...' : ''
      }))
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    
    res.json({ conversations: sortedConversations });
    
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

app.get("/conversation/:sessionId/:conversationId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const conversationId = req.params.conversationId;
    const userId = userSessions.get(sessionId);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const conversations = userConversations.get(userId) || [];
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    res.json({ conversation });
    
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

app.post("/conversation/new", (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = userSessions.get(sessionId);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newConversation = {
      id: conversationId,
      title: 'Yeni Konuşma',
      messages: [],
      createdAt: new Date(),
      lastMessageAt: new Date()
    };
    
    const conversations = userConversations.get(userId) || [];
    conversations.push(newConversation);
    userConversations.set(userId, conversations);
    
    res.json({ 
      success: true, 
      conversationId: conversationId,
      message: "New conversation created" 
    });
    
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Delete conversation endpoint
app.delete("/conversation/:sessionId/:conversationId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const conversationId = req.params.conversationId;
    const userId = userSessions.get(sessionId);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    let conversations = userConversations.get(userId) || [];
    const conversationIndex = conversations.findIndex(c => c.id === conversationId);
    
    if (conversationIndex === -1) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // Remove the conversation
    conversations.splice(conversationIndex, 1);
    userConversations.set(userId, conversations);
    
    res.json({ 
      success: true, 
      message: "Conversation deleted successfully" 
    });
    
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// File upload endpoint
app.post("/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const sessionId = req.body.sessionId || "default";
    const userMessage = req.body.message || "Analyze this file";
    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    
    let analysisResult;
    
    if (fileType.startsWith('image/')) {
      // Handle image analysis
      const imageData = fs.readFileSync(filePath);
      const imagePart = {
        inlineData: {
          data: imageData.toString('base64'),
          mimeType: fileType
        }
      };
      
      const result = await visionModel.generateContent([
        userMessage + " Please analyze this image in detail.",
        imagePart
      ]);
      
      analysisResult = await result.response.text();
    } else if (fileType === 'application/pdf') {
      // For PDF, we'll provide a basic response since Gemini doesn't directly process PDFs
      analysisResult = "PDF file received. Unfortunately, I cannot directly read PDF content yet, but I can see it's a PDF file named '" + req.file.originalname + "'. You can copy and paste text from the PDF for me to analyze.";
    }
    
    // Add to chat history
    if (!chatHistory.has(sessionId)) {
      chatHistory.set(sessionId, []);
    }
    const history = chatHistory.get(sessionId);
    history.push({ role: "user", content: `Uploaded file: ${req.file.originalname}` });
    history.push({ role: "assistant", content: analysisResult });
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({ 
      reply: analysisResult, 
      sessionId,
      fileName: req.file.originalname,
      fileType: fileType
    });
    
  } catch (error) {
    console.error("File upload error:", error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: "File analysis failed: " + error.message });
  }
});

// Sunucuyu başlat - sadece doğrudan çalıştırıldığında
if (require.main === module) {
  app.listen(3000, () => {
    console.log("Chatbot 3000 portunda çalışıyor 🚀 http://localhost:3000");
  });
}

// Vercel için uygulamayı dışa aktar
module.exports = app;
