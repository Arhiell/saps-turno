import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

const CODE_LENGTH = 4;

export default function FourDigitCodeInput({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, inputValue: string) => {
    const digits = inputValue.replace(/\D/g, '');
    if (digits.length > 1) {
      const pasted = digits.slice(0, CODE_LENGTH);
      onChange(pasted);
      inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    const digit = digits.slice(-1);
    const next = Array.from({ length: CODE_LENGTH }, (_, position) =>
      position === index ? digit : value[position] ?? '',
    ).join('');
    onChange(next);
    if (digit && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, CODE_LENGTH - index);
    if (!pasted) return;

    event.preventDefault();
    const next = Array.from({ length: CODE_LENGTH }, (_, position) =>
      position >= index && position < index + pasted.length
        ? pasted[position - index]
        : value[position] ?? '',
    ).join('');
    onChange(next);
    inputs.current[Math.min(index + pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="auth-code-inputs" aria-label={label}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => { inputs.current[index] = element; }}
          className="form-control auth-code-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Dígito ${index + 1} del código`}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onPaste={(event) => handlePaste(event, index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        />
      ))}
    </div>
  );
}