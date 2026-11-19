import { useState } from 'react'
import { useTheme, type Theme } from '../features/preferences/theme'
import { locales, useLocale } from '../shared/i18n'
import { PageTitle } from '../shared/ui'
import './settings.css'

export default function SettingsPage() {
  const { theme, setTheme, storageAvailable } = useTheme()
  const { locale, setLocale, t, storageAvailable: localeStorageAvailable } = useLocale()
  const [changed, setChanged] = useState(false)
  const options: { value: Theme; label: string; detail?: string }[] = [
    { value: 'system', label: 'Системная', detail: 'Следовать настройкам устройства' },
    { value: 'light', label: 'Светлая' },
    { value: 'dark', label: 'Тёмная' },
  ]
  return <div className="settings-page">
    <PageTitle eyebrow={t('Интерфейс')} title={t('Настройки')} description={t('Тема и язык применяются сразу и сохраняются в этом браузере.')}/>
    <div className="panel settings-panel">
      <fieldset className="settings-group"><legend>{t('Оформление')}</legend>
        <div className="settings-options">{options.map(option => <label className="settings-option" key={option.value}>
          <input type="radio" name="theme" value={option.value} checked={theme === option.value} onChange={() => { setTheme(option.value); setChanged(true) }}/>
          <span><strong>{t(option.label)}</strong>{option.detail && <small>{t(option.detail)}</small>}</span>
        </label>)}</div>
      </fieldset>
      <fieldset className="settings-group"><legend>{t('Язык интерфейса')}</legend>
        <div className="settings-options">{locales.map(language => <label className="settings-option" key={language.code}>
          <input type="radio" name="language" value={language.code} checked={locale === language.code} onChange={() => { setLocale(language.code); setChanged(true) }}/>
          <span><strong lang={language.code}>{language.label}</strong><small>{t(language.code === 'en' ? 'Английский' : language.label)}</small></span>
        </label>)}</div>
      </fieldset>
      <p className="settings-note">{t('Изменения сохраняются автоматически. Вход не требуется.')}</p>
      <div aria-live="polite" aria-atomic="true" className="settings-feedback">{!storageAvailable ? <p className="form-error">{t('Не удалось сохранить тему. Выбор действует до закрытия страницы.')}</p> : !localeStorageAvailable ? <p className="form-error">{t('Не удалось сохранить язык. Выбор действует до закрытия страницы.')}</p> : changed ? <p className="success-message">{t('Настройки обновлены.')}</p> : null}</div>
    </div>
  </div>
}
