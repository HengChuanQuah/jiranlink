// Service categories with multilingual keywords (English, Bahasa Malaysia, Chinese, Manglish).
// Keyword prefixes: "!" = core term (strong signal), "~" = weak hint, no prefix = normal.

export type CategoryGroup = "repairs" | "home" | "food" | "lessons" | "care" | "personal" | "errands";

export interface Category {
  id: string;
  name: string;
  nameBm: string;
  group: CategoryGroup;
  icon: string; // key into the icon set
  onlineCapable: boolean;
  licensed?: boolean; // show "check the provider is licensed" note
  keywords: string[];
}

export const GROUPS: { id: CategoryGroup; label: string; labelBm: string }[] = [
  { id: "repairs", label: "Repairs", labelBm: "Pembaikan" },
  { id: "home", label: "Cleaning & home", labelBm: "Kebersihan & rumah" },
  { id: "food", label: "Food", labelBm: "Makanan" },
  { id: "lessons", label: "Lessons", labelBm: "Kelas" },
  { id: "care", label: "Care", labelBm: "Penjagaan" },
  { id: "personal", label: "Beauty & personal", labelBm: "Kecantikan" },
  { id: "errands", label: "Errands & other", labelBm: "Lain-lain" },
];

export const CATEGORIES: Category[] = [
  // Repairs
  {
    id: "aircond", name: "Aircond servicing & repair", nameBm: "Servis aircond", group: "repairs", icon: "snow", onlineCapable: false,
    keywords: ["!aircond", "!aircon", "!air cond", "!air conditioner", "!air-con", "!penghawa dingin", "!冷气", "!空调",
      "tak sejuk", "not cold", "not cooling", "x sejuk", "bocor air", "dripping", "drip", "leaking water from aircond", "chemical wash", "chemical cuci",
      "gas top up", "isi gas", "aircond bising", "aircond bunyi", "冷气漏水", "不冷", "~cooling", "~btu", "~sejuk"] },
  {
    id: "plumbing", name: "Plumbing", nameBm: "Tukang paip", group: "repairs", icon: "drop", onlineCapable: false,
    keywords: ["!plumber", "!plumbing", "!tukang paip", "!paip", "!水管", "!水喉", "pipe", "pipe leak", "paip bocor", "sink", "sinki", "singki",
      "tersumbat", "clogged", "clog", "blocked drain", "longkang tersumbat", "toilet", "tandas", "jamban", "flush", "pam tandas", "tap", "pili",
      "water heater", "pemanas air", "heater", "water pressure", "tekanan air", "塞住", "漏水", "马桶", "~leak", "~bocor", "~air"] },
  {
    id: "electrical", name: "Electrical wiring & lights", nameBm: "Pendawaian elektrik", group: "repairs", icon: "bolt", onlineCapable: false, licensed: true,
    keywords: ["!electrician", "!wiring", "!pendawaian", "!wireman", "!电工", "!电线", "trip", "power trip", "tripping", "elcb", "rccb", "db box", "fius",
      "fuse", "socket", "soket", "plug point", "lampu", "light bulb", "lights not working", "lampu rosak", "kipas siling", "ceiling fan", "fan install",
      "跳电", "插座", "~electric", "~elektrik", "~api"] },
  {
    id: "handyman", name: "Handyman & small fixes", nameBm: "Tukang am", group: "repairs", icon: "wrench", onlineCapable: false,
    keywords: ["!handyman", "!tukang", "!修理", "fix door", "door hinge", "engsel", "pintu rosak", "drill", "gerudi", "hang", "gantung", "curtain",
      "langsir", "rail", "shelf", "rak", "tv mount", "pasang tv", "furniture assembly", "assemble", "ikea", "pasang perabot", "cabinet door",
      "kabinet", "tile", "jubin", "grout", "装", "~fix", "~repair", "~baiki", "~rosak", "~broken", "~pasang"] },
  {
    id: "painting", name: "Painting & touch-ups", nameBm: "Mengecat", group: "repairs", icon: "brush", onlineCapable: false,
    keywords: ["!painter", "!painting", "!cat rumah", "!mengecat", "!油漆", "repaint", "wall paint", "cat dinding", "dinding", "wall crack", "retak",
      "peeling paint", "cat tertanggal", "~paint", "~cat", "~wall"] },
  {
    id: "appliance", name: "Appliance repair", nameBm: "Baiki perkakas", group: "repairs", icon: "plug", onlineCapable: false,
    keywords: ["!appliance", "!perkakas", "!电器", "washing machine", "mesin basuh", "!fridge", "!peti sejuk", "!peti ais", "refrigerator", "oven",
      "microwave", "dryer", "pengering", "water dispenser", "penapis air", "water filter", "洗衣机", "冰箱", "~machine", "~mesin"] },
  {
    id: "pest", name: "Pest control", nameBm: "Kawalan serangga", group: "repairs", icon: "bug", onlineCapable: false, licensed: true,
    keywords: ["!pest", "!pest control", "!serangga", "!除虫", "termite", "anai-anai", "anai anai", "cockroach", "lipas", "rat", "tikus", "ants", "semut",
      "bed bug", "pijat", "fogging", "nyamuk", "mosquito", "白蚁", "蟑螂", "老鼠"] },
  {
    id: "locksmith", name: "Locksmith", nameBm: "Tukang kunci", group: "repairs", icon: "key", onlineCapable: false,
    keywords: ["!locksmith", "!tukang kunci", "!开锁", "locked out", "terkunci", "kunci", "lock", "duplicate key", "pendua kunci", "digital lock", "kunci digital",
      "~key", "~gate"] },

  // Cleaning & home
  {
    id: "cleaning", name: "Home cleaning", nameBm: "Cuci rumah", group: "home", icon: "sparkle", onlineCapable: false,
    keywords: ["!cleaner", "!cleaning", "!cuci rumah", "!kemas rumah", "!清洁", "!打扫", "maid", "part time maid", "pembantu", "mop", "mengemop",
      "vacuum", "deep clean", "move-in clean", "move out clean", "spring clean", "bersih", "kotor", "dirty", "kitchen grease", "~clean", "~cuci", "~kemas"] },
  {
    id: "laundry", name: "Laundry & ironing", nameBm: "Dobi & gosok baju", group: "home", icon: "shirt", onlineCapable: false,
    keywords: ["!laundry", "!dobi", "!ironing", "!洗衣服", "!烫衣", "iron", "gosok baju", "seterika", "basuh baju", "cuci baju", "fold clothes",
      "lipat baju", "curtain wash", "cuci langsir", "~baju", "~clothes"] },
  {
    id: "gardening", name: "Gardening & lawn", nameBm: "Berkebun & potong rumput", group: "home", icon: "leaf", onlineCapable: false,
    keywords: ["!gardener", "!gardening", "!tukang kebun", "!园丁", "!花园", "garden", "kebun", "lawn", "rumput", "potong rumput", "grass cutting",
      "mow", "trim", "pruning", "cantas", "pokok", "tree", "plants", "pokok bunga", "overgrown", "semak", "landscape", "~green"] },
  {
    id: "carwash", name: "Car wash at home", nameBm: "Cuci kereta", group: "home", icon: "car", onlineCapable: false,
    keywords: ["!car wash", "!cuci kereta", "!洗车", "car polish", "polish kereta", "car detailing", "detailing", "interior car", "vacuum kereta", "~kereta", "~car"] },

  // Food
  {
    id: "cakes", name: "Cakes & baking", nameBm: "Kek & bakeri", group: "food", icon: "cake", onlineCapable: false,
    keywords: ["!cake", "!kek", "!baker", "!蛋糕", "birthday cake", "kek hari jadi", "kek harijadi", "cupcake", "brownies", "cookies", "biskut raya",
      "kuih raya", "bake", "bakar kek", "bread", "roti", "tart", "pastry", "生日蛋糕", "饼干", "~birthday", "~hari jadi", "~sweet", "~dessert"] },
  {
    id: "kuih", name: "Kuih & traditional snacks", nameBm: "Kuih-muih", group: "food", icon: "leaf2", onlineCapable: false,
    keywords: ["!kuih", "!kueh", "!糕点", "!娘惹糕", "kuih muih", "nyonya kuih", "onde onde", "seri muka", "karipap", "curry puff", "kuih lapis",
      "apam", "popiah", "nasi lemak", "breakfast pack", "sarapan", "~snack", "~petang"] },
  {
    id: "meals", name: "Home-cooked meals & catering", nameBm: "Masakan rumah & katering", group: "food", icon: "bowl", onlineCapable: false,
    keywords: ["!catering", "!katering", "!home cooked", "!masakan rumah", "!家常菜", "!便当", "tiffin", "tapau", "lunch box", "bekal", "meal plan",
      "makan tengah hari", "dinner", "lauk", "nasi", "party food", "open house", "rumah terbuka", "kenduri", "doa selamat", "potluck", "~food",
      "~makanan", "~makan", "~meal", "~cook", "~masak"] },

  // Lessons
  {
    id: "tuition", name: "School tuition", nameBm: "Tuisyen sekolah", group: "lessons", icon: "book", onlineCapable: true,
    keywords: ["!tuition", "!tutor", "!tuisyen", "!补习", "!家教", "math", "maths", "matematik", "sains", "science", "add maths", "spm", "upsr",
      "pt3", "uasa", "homework", "kerja sekolah", "darjah", "tingkatan", "form 4", "form 5", "standard 5", "primary school", "secondary school",
      "physics", "fizik", "chemistry", "kimia", "biology", "biologi", "sejarah", "数学", "功课", "~cikgu", "~teacher", "~belajar", "~study", "~exam", "~peperiksaan"] },
  {
    id: "language", name: "Language lessons", nameBm: "Kelas bahasa", group: "lessons", icon: "chat", onlineCapable: true,
    keywords: ["!language class", "!kelas bahasa", "!语言", "english", "bahasa inggeris", "mandarin", "bahasa cina", "华语", "中文", "tamil", "bahasa arab",
      "arabic", "japanese", "korean", "bahasa melayu", "malay class", "speaking", "conversation", "ielts", "muet", "~bahasa", "~language"] },
  {
    id: "music", name: "Music lessons", nameBm: "Kelas muzik", group: "lessons", icon: "music", onlineCapable: true,
    keywords: ["!music", "!muzik", "!音乐", "piano", "guitar", "gitar", "violin", "biola", "drum", "dram", "vocal", "nyanyi", "singing", "ukulele",
      "钢琴", "吉他", "abrsm", "~lesson"] },
  {
    id: "quran", name: "Quran & religious classes", nameBm: "Kelas mengaji & agama", group: "lessons", icon: "moon", onlineCapable: true,
    keywords: ["!quran", "!mengaji", "!ustaz", "!ustazah", "iqra", "tajwid", "fardu ain", "kelas agama", "hafazan", "jawi", "~agama"] },
  {
    id: "coding", name: "Computer & coding classes", nameBm: "Kelas komputer & kod", group: "lessons", icon: "code", onlineCapable: true,
    keywords: ["!coding", "!programming", "!kelas komputer", "!编程", "scratch", "python", "robotics", "robotik", "excel", "microsoft office",
      "computer class", "belajar komputer", "电脑课", "~komputer", "~computer"] },
  {
    id: "fitness", name: "Fitness & sports coaching", nameBm: "Jurulatih kecergasan", group: "lessons", icon: "run", onlineCapable: true,
    keywords: ["!personal trainer", "!fitness", "!jurulatih", "!健身", "gym", "senaman", "exercise", "yoga", "pilates", "zumba", "swimming", "renang",
      "badminton", "tennis", "futsal coach", "lose weight", "kurus", "游泳", "~coach", "~workout"] },

  // Care
  {
    id: "childcare", name: "Babysitting & childminding", nameBm: "Pengasuh kanak-kanak", group: "care", icon: "baby", onlineCapable: false,
    keywords: ["!babysitter", "!babysit", "!babysitting", "!pengasuh", "!保姆", "nanny", "jaga anak", "jaga budak", "asuh anak", "taska", "childminder",
      "after school care", "transit", "fetch kids", "ambil anak", "ambil budak", "看孩子", "~anak", "~kids", "~baby", "~bayi"] },
  {
    id: "eldercare", name: "Eldercare & companionship", nameBm: "Penjagaan warga emas", group: "care", icon: "heart", onlineCapable: false,
    keywords: ["!eldercare", "!caregiver", "!warga emas", "!penjaga", "!看护", "!老人", "jaga mak", "jaga ayah", "jaga nenek", "jaga atuk", "elderly",
      "old folks", "companion", "teman", "temankan", "temankan ke hospital", "hospital appointment", "klinik", "bedridden", "terlantar", "~parents", "~mak", "~ayah"] },
  {
    id: "petcare", name: "Pet sitting & walking", nameBm: "Penjagaan haiwan", group: "care", icon: "paw", onlineCapable: false,
    keywords: ["!pet sitter", "!pet sitting", "!dog walker", "!jaga kucing", "!遛狗", "!宠物", "walk my dog", "walk dog", "bawa anjing jalan", "dog walking",
      "jaga anjing", "feed cat", "bagi kucing makan", "cat sitting", "boarding", "~kucing", "~cat", "~dog", "~anjing", "~pet", "~猫", "~狗"] },
  {
    id: "petgrooming", name: "Pet grooming", nameBm: "Dandanan haiwan", group: "care", icon: "scissors", onlineCapable: false,
    keywords: ["!pet grooming", "!grooming", "!mandikan kucing", "!宠物美容", "cat grooming", "dog grooming", "potong bulu", "trim fur", "mandi kucing",
      "nail trim", "potong kuku kucing", "~bulu", "~fur"] },

  // Beauty & personal
  {
    id: "haircut", name: "Haircut at home", nameBm: "Gunting rambut", group: "personal", icon: "comb", onlineCapable: false,
    keywords: ["!haircut", "!gunting rambut", "!barber", "!剪头发", "!理发", "potong rambut", "trim hair", "hair cut", "gunting", "rambut", "hair colour",
      "warna rambut", "~hair"] },
  {
    id: "beauty", name: "Makeup & beauty", nameBm: "Mekap & kecantikan", group: "personal", icon: "star", onlineCapable: false,
    keywords: ["!makeup", "!make up", "!mekap", "!化妆", "mua", "makeup artist", "bridal", "pengantin", "wedding makeup", "henna", "inai", "manicure",
      "pedicure", "nail art", "facial", "kening", "threading", "~beauty", "~cantik"] },
  {
    id: "tailoring", name: "Tailoring & alterations", nameBm: "Jahitan & alter", group: "personal", icon: "needle", onlineCapable: false,
    keywords: ["!tailor", "!tukang jahit", "!jahit", "!裁缝", "alteration", "alter baju", "potong seluar", "shorten pants", "pendekkan seluar", "baju kurung",
      "baju melayu", "zip rosak", "broken zip", "hem", "sew", "shorten", "pants", "seluar", "trousers", "dress", "~baju raya"] },
  {
    id: "photo", name: "Photography & video", nameBm: "Fotografi", group: "personal", icon: "camera", onlineCapable: false,
    keywords: ["!photographer", "!photography", "!jurugambar", "!摄影", "photo shoot", "photoshoot", "family photo", "gambar keluarga", "event photo",
      "videographer", "video", "birthday party photo", "~gambar", "~photo"] },

  // Errands & other
  {
    id: "errands", name: "Errands & grocery runs", nameBm: "Urusan & beli barang", group: "errands", icon: "bag", onlineCapable: false,
    keywords: ["!errand", "!runner", "!beli barang", "!跑腿", "grocery", "groceries", "barang dapur", "pasar", "market run", "pick up parcel",
      "ambil parcel", "pos barang", "post office", "bayar bil", "pay bills", "queue", "beratur", "买菜", "~tolong", "~help me buy"] },
  {
    id: "moving", name: "Moving & heavy lifting", nameBm: "Pindah rumah & angkat barang", group: "errands", icon: "box", onlineCapable: false,
    keywords: ["!movers", "!moving", "!pindah rumah", "!搬家", "lorry", "lori", "angkat barang", "carry furniture", "heavy", "berat", "dispose furniture",
      "buang perabot", "sofa", "tilam", "mattress", "~pindah", "~angkat"] },
  {
    id: "devicerepair", name: "Phone & computer help", nameBm: "Baiki telefon & komputer", group: "errands", icon: "phone", onlineCapable: true,
    keywords: ["!phone repair", "!laptop repair", "!baiki telefon", "!修电脑", "!修手机", "laptop", "komputer rosak", "computer slow", "slow computer",
      "virus", "screen crack", "skrin pecah", "wifi", "router", "printer", "setup phone", "data recovery", "skrin", "screen", "phone", "telefon", "handphone", "~hp"] },
  {
    id: "design", name: "Design & printing", nameBm: "Reka bentuk & cetakan", group: "errands", icon: "pen", onlineCapable: true,
    keywords: ["!graphic design", "!designer", "!reka bentuk", "!设计", "logo", "poster", "banner", "kad jemputan", "invitation card", "wedding card",
      "flyer", "risalah", "printing", "cetak", "canva", "~design"] },
];

export const categoryById = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id);
