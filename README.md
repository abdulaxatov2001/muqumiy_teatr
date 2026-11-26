# Muqimiy Teatri — Rasmiy Veb-sayt Loyihasi

**Muqimiy nomidagi O'zbekiston davlat akademik musiqali teatri** uchun zamonaviy, minimalist va yorqin dizayndagi veb-sayt.

## Asosiy imkoniyatlar

- **Ko'p tillilik (UZ / RU / EN):** O'zbek, Rus va Ingliz tillarida to'liq interfeys va ma'lumotlar (`localStorage` orqali tilni eslab qolish).
- **Repertuar va Qidiruv:** Janrlar (*Musiqali drama*, *Komediya*, *Klassika*, *Etno-poema*) bo'yicha filtrlash, tezkor qidiruv va spektakl tafsilotlari modali.
- **Ijodiy jamoa va Yangiliklar:** Solist-vokalistlar, aktyorlar va teatr hayotidagi so'nggi tadbirlar (yangiliklarni bosib batafsil o'qish imkoniyati).
- **Rasmiy zal sxemasi bo'yicha interaktiv bron:**
  - *Balkon*, *Amfiteatr (7–12 qatorlar)* va *Parter (1–6 qatorlar)* o'ngdan chapga raqamlash tartibi bilan.
  - Jonli narx hisoblash, band o'rinlarni `localStorage` da saqlash va `MQ-...` bron kodini generatsiya qilish.

## Loyiha tuzilmasi

```text
├── index.html          # Asosiy sahifa
├── styles/
│   └── main.css        # Minimalist yorqin dizayn tizimi
├── scripts/
│   ├── i18n.js         # UZ / RU / EN tarjimalar
│   ├── data.js         # Spektakllar, aktyorlar, yangiliklar va zal sxemasi
│   └── app.js          # Interaktiv mantiq va bron tizimi
└── images/             # Teatr va spektakllar rasmlari
```

## Ishga tushirish

`index.html` faylini istalgan brauzerda oching yoki lokal server orqali ishga tushiring:

```bash
python3 -m http.server 8000
```

## Keyingi bosqichlar

- [ ] Admin panel (spektakllar, seanslar, narxlar va bronlarni boshqarish)
- [ ] Backend API integratsiyasi
