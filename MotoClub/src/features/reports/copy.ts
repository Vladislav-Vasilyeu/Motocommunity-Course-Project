import { t } from '../../shared/i18n'
import { en as sharedEnglish } from '../../shared/translations'

const en: Record<string, string> = {
  'Пожаловаться': 'Report', 'Жалобы': 'Reports', 'Мои жалобы': 'My reports', 'Безопасность сообщества': 'Community safety',
  'Сообщите о нарушении. Решение принимает модератор.': 'Report a violation. A moderator reviews each report.',
  'Войдите, чтобы отправить жалобу и посмотреть её статус.': 'Sign in to submit a report and check its status.', 'Войти': 'Sign in',
  'Новая жалоба': 'New report', 'Объект': 'Target', 'Пользователь': 'User', 'Публикация': 'Post', 'Объявление': 'Listing', 'Сообщество': 'Community',
  'Идентификатор объекта': 'Target ID', 'Причина (5–2000 символов)': 'Reason (5–2000 characters)', 'Отправить жалобу': 'Submit report',
  'Отправляю…': 'Submitting…', 'Жалоба отправлена модератору.': 'Your report has been sent to a moderator.', 'История жалоб': 'Report history',
  'Жалоб пока нет': 'No reports yet', 'Отправленные жалобы и решения появятся здесь.': 'Your reports and decisions will appear here.',
  'Ожидает проверки': 'Pending', 'Решена': 'Resolved', 'Отклонена': 'Dismissed', 'Комментарий модератора': 'Moderator note',
  'Модерация': 'Moderation', 'Очередь жалоб': 'Report queue', 'Проверьте обращение и сохраните решение.': 'Review each report and save your decision.',
  'Недостаточно прав': 'Access denied', 'Этот раздел доступен модераторам и администраторам.': 'This area is available to moderators and administrators.',
  'Все': 'All', 'Нет жалоб': 'No reports', 'В выбранном статусе пока нет обращений.': 'There are no reports with this status.',
  'Решение сохранено.': 'Decision saved.', 'Решить': 'Resolve', 'Отклонить': 'Dismiss', 'Удалить объект': 'Delete target',
  'Удалить этот объект? Для сообщества также удалятся его публикации. Действие нельзя отменить.': 'Delete this target? Deleting a community also deletes its posts. This cannot be undone.',
  'Сохраняю…': 'Saving…', 'Открыть объект': 'Open target', 'Отправитель': 'Reporter',
  'Чтобы отправить жалобу, нажмите «Пожаловаться» рядом с публикацией, объявлением, сообществом или профилем.': 'To submit a report, choose Report next to a post, listing, community or profile.',
}
Object.assign(sharedEnglish, en)
export function reportText(text: string) { return t(text) }
export const targetLabels = { USER: 'Пользователь', POST: 'Публикация', LISTING: 'Объявление', COMMUNITY: 'Сообщество' }
export const statusLabels = { PENDING: 'Ожидает проверки', RESOLVED: 'Решена', DISMISSED: 'Отклонена' }
