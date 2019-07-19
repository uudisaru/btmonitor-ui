import { format, distanceInWordsToNow } from 'date-fns';

export function updateTime(time?: Date): string {
  let formatted = '';
  if (time) {
    formatted = 'Updated: ' + format(time, 'DD.MM.YYYY HH:mm:ss');
    formatted +=
      ' (' +
      distanceInWordsToNow(time, {
        addSuffix: true,
        includeSeconds: true
      }) +
      ')';

    return formatted;
  }

  return formatted;
}
