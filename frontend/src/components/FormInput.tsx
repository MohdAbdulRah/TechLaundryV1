import React, { useState } from 'react';

interface FormInputProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function FormInput({
  id, label, type = 'text', placeholder, value, onChange,
  error, hint, required, autoComplete, icon, disabled,
}: FormInputProps) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div className="input-group">
      <label htmlFor={id} className="input-label">
        {label}
        {required && <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>}
      </label>

      <div className="input-wrap">
        {icon && <span className="input-icon">{icon}</span>}

        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`input${error ? ' error' : ''}${!icon ? ' no-icon' : ''}`}
          style={!icon ? { paddingLeft: 14 } : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={!!error}
        />

        {isPassword && (
          <button
            type="button"
            className="input-icon-right"
            onClick={() => setShowPw(v => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {error && <span id={`${id}-error`} className="input-hint error">{error}</span>}
      {hint && !error && <span id={`${id}-hint`} className="input-hint">{hint}</span>}
    </div>
  );
}