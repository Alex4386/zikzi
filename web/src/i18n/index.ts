import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ko from './locales/ko.json'

const savedLanguage = localStorage.getItem('zikzi-language') || navigator.language.split('-')[0] || 'en'

// Update the HTML lang attribute
function updateHtmlLang(lang: string) {
  document.documentElement.lang = lang
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

// Set initial HTML lang attribute
updateHtmlLang(savedLanguage)

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  updateHtmlLang(lng)
})

export default i18n

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
] as const

export type LanguageCode = (typeof languages)[number]['code']

export function setLanguage(code: LanguageCode) {
  i18n.changeLanguage(code)
  localStorage.setItem('zikzi-language', code)
}
