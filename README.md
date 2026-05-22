# Miora by Layal - Photo Album Creator Platform

A beautiful, bilingual (Arabic/English) photo album creation platform with drag-and-drop design, AI-powered layouts, and preset templates.

## Features

✨ **Three Creation Modes:**
- Manual Design: Full drag-and-drop editor with stickers, text, and decorations
- AI-Powered: Upload photos and let AI automatically arrange them
- Templates: Choose from pre-designed album layouts

🌍 **Bilingual Support:** Full Arabic and English support with RTL layout

💾 **Auto-Save:** Projects saved locally in browser storage (localStorage)

💳 **Payment Integration:** CliQ payment system with proof upload for owner verification

⭐ **Reviews:** Customer testimonials with 5-star ratings

📱 **Responsive Design:** Works seamlessly on desktop, tablet, and mobile

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone or extract the repository
cd netlify-deploy

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `build/` folder.

## Deployment to Netlify

### Option 1: Using Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to your Netlify account
netlify login

# Deploy the site
netlify deploy --prod
```

### Option 2: Connect GitHub Repository

1. Push this folder to a GitHub repository
2. Go to [netlify.com](https://netlify.com)
3. Click "New site from Git"
4. Connect your GitHub account and select the repository
5. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
6. Click "Deploy site"

### Option 3: Drag & Drop Deploy

1. Run `npm run build` locally
2. Go to [netlify.com](https://netlify.com)
3. Drag and drop the `build/` folder onto the Netlify interface

## Project Structure

```
netlify-deploy/
├── public/
│   └── index.html          # HTML entry point
├── src/
│   ├── index.js            # React initialization
│   ├── App.js              # App wrapper
│   └── MioraPlatform.jsx    # Main platform component
├── netlify.toml            # Netlify configuration
├── package.json            # Dependencies and scripts
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Local Storage (Browser Storage)

All user data is stored locally in the browser using localStorage:
- **Projects**: Album designs and progress
- **Reviews**: Customer testimonials
- **Payments**: Payment records
- **Language preference**: User's selected language

**Note:** Data persists only on the same device/browser. To enable cloud sync, a backend database (Firebase, Supabase, etc.) would be needed.

## Pricing Tiers

| Pages | Price |
|-------|-------|
| 30–40 | 22–25 JOD |
| 41–55 | 26–29 JOD |
| 56–70 | 34–37 JOD |
| 71–85 | 34–37 JOD |
| 86–100 | 38–41 JOD |
| 101–115 | 42–46 JOD |
| 116–130 | 47–50 JOD |
| 131–146 | 51–55 JOD |
| 147–162 | 56–60 JOD |
| 163–178 | 61–65 JOD |

## Occasions Supported

- Wedding 💍
- Baby Shower 🍼
- Birthday 🎂
- Graduation 🎓
- Engagement 💐
- Travel ✈️
- Family 👨‍👩‍👧‍👦
- Anniversary ❤️

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- [ ] Backend integration for server-side saves
- [ ] User authentication and accounts
- [ ] Cloud storage for projects
- [ ] Admin dashboard for payment review
- [ ] Expanded sticker and font library
- [ ] PDF export functionality
- [ ] Email notifications
- [ ] Social sharing

## Colors & Theme

- **Primary Purple**: #D8C0FF (Pastel Purple)
- **Deep Purple**: #7B5EA7
- **Dark Purple**: #4A3068
- **Gold Accent**: #D4A853
- **Soft Pink**: #F5E6FF

## Fonts

- **Display**: Londrina Solid (MIORA branding)
- **Serif**: Playfair Display (section titles)
- **Body**: Quicksand (primary text)
- **Arabic**: Noto Sans Arabic

## Support

For questions or issues:
- Email: contact@miorabylayal.com
- Instagram: @miorabylayal
- WhatsApp: [Add WhatsApp link]

## License

© 2026 Miora by Layal. All rights reserved.

---

**Made with 💜 for capturing life's beautiful moments**
