import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Common = { value: string; onValue: (v: string) => void; multiline?: boolean };
type Props = Common & Omit<InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

/**
 * Text field that owns its text while focused. Saving through an async store re-renders with a lagging value,
 * which breaks IME composition (Japanese kana → kanji on iOS turns into repeated characters). The prop value
 * is only adopted while the field is not being edited, and updates are not sent mid-composition.
 */
export default function TextInput({ value, onValue, multiline, onFocus, onBlur, ...rest }: Props) {
  const [text, setText] = useState(value);
  const editing = useRef(false);
  const composing = useRef(false);

  useEffect(() => { if (!editing.current) setText(value); }, [value]);

  const props = {
    ...rest,
    value: text,
    onFocus: (e: never) => { editing.current = true; (onFocus as ((e: never) => void) | undefined)?.(e); },
    onBlur: (e: never) => {
      editing.current = false;
      if (text !== value) onValue(text);
      (onBlur as ((e: never) => void) | undefined)?.(e);
    },
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: (e: { currentTarget: { value: string } }) => { composing.current = false; onValue(e.currentTarget.value); },
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value);
      if (!composing.current) onValue(e.target.value);
    },
  };
  return multiline ? <textarea {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} /> : <input {...(props as InputHTMLAttributes<HTMLInputElement>)} />;
}
