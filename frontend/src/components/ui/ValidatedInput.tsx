import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
} from 'react';

import {
  fieldError,
  fieldRule,
} from '../../utils/field-validation';

type Props =
  InputHTMLAttributes<HTMLInputElement> & {
    field?: string;
  };

// Valida la entrada del usuario antes de enviarla al backend.
export default function ValidatedInput({
  field = '',
  onChange,
  onKeyDown,
  onPaste,
  value,
  type = 'text',
  ...props
}: Props) {
  const ref =
    useRef<HTMLInputElement>(null);

  const rule =
    fieldRule(field);

  const text =
    String(value ?? '');

  // Obtiene el error actual del campo.
  const error =
    props.required &&
    text &&
    !text.trim()
      ? 'Este campo no puede contener solamente espacios.'
      : fieldError(
          field,
          text,
          type
        );

  // Sincroniza la validación con el input nativo.
  useEffect(() => {
    ref.current?.setCustomValidity(
      error
    );
  }, [error, value]);

  return (
    <input
      {...props}
      ref={ref}
      type={type}
      value={value}
      minLength={
        props.minLength ??
        rule?.min
      }
      maxLength={
        props.maxLength ??
        rule?.max
      }
      inputMode={
        props.inputMode ??
        (
          field === 'dni'
            ? 'numeric'
            : field.includes(
                'telefono'
              )
              ? 'tel'
              : undefined
        )
      }
      title={
        props.title ??
        rule?.message
      }
      onKeyDown={(event) => {
        if (
          type === 'number' &&
          ['e', 'E'].includes(
            event.key
          )
        ) {
          event.preventDefault();
        }

        onKeyDown?.(event);
      }}
      onPaste={(event) => {
        if (
          type === 'number' &&
          !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(
            event.clipboardData
              .getData('text')
              .trim()
          )
        ) {
          event.preventDefault();
        }

        onPaste?.(event);
      }}
      onChange={(event) => {
        const input =
          event.currentTarget;

        if (
          type === 'number' &&
          input.value &&
          fieldError(
            field,
            input.value,
            type
          )
        ) {
          return;
        }

        if (
          rule &&
          !rule.characters.test(
            input.value
          )
        ) {
          input.setCustomValidity(
            rule.message
          );

          input.reportValidity();

          input.setCustomValidity(
            error
          );

          return;
        }

        input.setCustomValidity(
          fieldError(
            field,
            input.value,
            type
          )
        );

        onChange?.(event);
      }}
    />
  );
}