"use client";

import { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input visual para `react-datepicker` (customInput): mismo lenguaje que inputs FotoRank,
 * icono de calendario visible y zona clickeable clara.
 */
export const FrDatePickerCustomInput = forwardRef<HTMLInputElement, Props>(
  function FrDatePickerCustomInput({ className = "", ...rest }, ref) {
    return (
      <div className="fr-date-picker-trigger-wrap">
        <input ref={ref} readOnly className={`fr-date-picker-trigger-input ${className}`.trim()} {...rest} />
        <span className="fr-date-picker-trigger-icon" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </span>
      </div>
    );
  },
);
