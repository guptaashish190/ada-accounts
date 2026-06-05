export const hasPrintableText = (value) => {
  if (value == null) return false;
  const text = String(value).trim();
  return text.length > 0 && text !== 'undefined';
};

export const pushNoteLineIfPresent = (commands, label, value, style) => {
  if (!hasPrintableText(value)) return;
  commands.push({
    type: 'text',
    value: `${label}: ${String(value).trim()}`,
    style,
  });
};
