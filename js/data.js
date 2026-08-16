// ====== ФЕЙКОВЫЕ ДАННЫЕ ======
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#ff9a9e,#fad0c4)",
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#f093fb,#f5576c)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#36d1dc,#5b86e5)",
  "linear-gradient(135deg,#fa709a,#fee140)",
  "linear-gradient(135deg,#30cfd0,#330867)",
];

const GRADIENT_NAMES = ["Розовый", "Фиолетовый", "Малиновый", "Мятный", "Песочный", "Лазурный", "Золотой", "Океан"];

const DEFAULT_PROFILE = {
  name: "Вы",
  avatar: 0,
  status: "В сети",
  bio: "",
  phone: "+7 900 000-00-00",
  username: "lilbru",
  banner: null,
  bannerImg: null,
};

const BANNERS = [
  "linear-gradient(135deg,#7c6cff,#4f8cff)",
  "linear-gradient(135deg,#ff6b81,#f5576c)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#36d1dc,#5b86e5)",
  "linear-gradient(135deg,#fa709a,#fee140)",
  "linear-gradient(135deg,#8b5cf6,#d946ef)",
  "linear-gradient(135deg,#f43f5e,#fbbf24)",
];
const PREMIUM_BANNER_IDS = [6, 7];

const DEFAULT_SETTINGS = {
  theme: "light",
  accent: ["#261386", "#261386"],
  sound: true,
  glass: 0.6,
  enterSend: true,
  anim: true,
  chatBg: -1,
  notify: true,
  customBg: "#0a0d1c",
  chatBgImg: null,
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const GROUP_REPLIES = [
  "Принято, коллеги 👍",
  "Согласен, давай так",
  "Кто-нибудь глянул этот файл?",
  "Обсудим на созвоне",
  "Хорошая идея, поддерживаю",
  "Я на месте, слушаю",
  "Добавил в общий список",
  "Го в пятницу обсудим?",
];

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","🥰","😘","😎","🤩","🥳","😇","🙃","😉","🤔","🤨",
  "😴","🤯","😱","😭","😅","🙄","😜","🤪","😤","🤬","👻","💀","👽","🤖","💩","👋",
  "👍","👎","👏","🙏","🤝","💪","🫶","✌️","🤞","💯","🔥","✨","⭐","🌙","☀️","🌈",
  "⚡","❄️","💧","🍕","🍔","🌮","🥞","🍩","☕","🍺","🎂","🍿","🎧","🎮","🎬","🎉",
  "🎁","🏆","⚽","🐱","🐶","🦊","🐼","🐸","🦄","🐝","🌸","🌹","🌊","❤️","💔","💖",
];

const FAKE_FILES = [
  { name: "презентация_финал.pptx", size: "2,4 МБ" },
  { name: "фото_с_макета.png", size: "1,1 МБ" },
  { name: "заметки_по_проекту.md", size: "8 КБ" },
  { name: "музыка/трек_42.mp3", size: "5,8 МБ" },
];

let CHAT_SEQ = 100;

const RANDOM_MSGS = [
  "Привет! Чем занимаешься?",
  "Скинь, пожалуйста, тот файл ещё раз 😅",
  "Видел новости? Прям ух",
  "Окей, договорились 👌",
  "А ты уже пообедал?",
  "Кстати, спасибо за вчера!",
  "Ну что, как проходит день?",
  "Кину тебе потом, ок?",
  "Хаха, точно 😂",
  "Забегу попозже, не теряйся",
  "Слушай, а ты как на это смотришь?",
  "Я почти всё доделал, вечером расскажу",
  "Ой, забыла спросить — как дела?",
  "До встречи завтра!",
  "Ты тут?",
];

// Уникальные ID сообщений между вкладками (число, без коллизий)
const MSG_TAB_SEED = Math.floor(Math.random() * 1e6);
let MSG_SEQ = 0;

function seedMsgId() {
  return MSG_TAB_SEED * 1e6 + ++MSG_SEQ;
}