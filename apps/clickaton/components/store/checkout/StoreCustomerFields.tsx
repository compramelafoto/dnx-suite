"use client";

type Props = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  onChange: {
    firstName: (v: string) => void;
    lastName: (v: string) => void;
    email: (v: string) => void;
    phone: (v: string) => void;
  };
  disabled?: boolean;
};

const fieldClass =
  "mt-2 w-full min-h-11 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-bg px-4 py-3 text-ck-text placeholder:text-ck-text-muted focus:border-ck-yellow focus:outline-none focus:ring-2 focus:ring-ck-yellow/20";

export function StoreCustomerFields({
  firstName,
  lastName,
  email,
  phone,
  onChange,
  disabled,
}: Props) {
  return (
    <fieldset className="space-y-8" disabled={disabled}>
      <legend className="ck-heading-md">Datos de contacto</legend>
      <p className="ck-body-sm text-ck-text-muted">
        Usaremos estos datos para coordinar el retiro y avisarte el estado del pedido.
      </p>
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor="store-first-name" className="text-sm font-semibold text-ck-text">
            Nombre <span className="text-ck-yellow">*</span>
          </label>
          <input
            id="store-first-name"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={80}
            className={fieldClass}
            value={firstName}
            onChange={(e) => onChange.firstName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="store-last-name" className="text-sm font-semibold text-ck-text">
            Apellido <span className="text-ck-yellow">*</span>
          </label>
          <input
            id="store-last-name"
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={80}
            className={fieldClass}
            value={lastName}
            onChange={(e) => onChange.lastName(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="store-email" className="text-sm font-semibold text-ck-text">
          Email <span className="text-ck-yellow">*</span>
        </label>
        <input
          id="store-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={160}
          className={fieldClass}
          value={email}
          onChange={(e) => onChange.email(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="store-phone" className="text-sm font-semibold text-ck-text">
          Teléfono <span className="text-ck-yellow">*</span>
        </label>
        <input
          id="store-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          maxLength={32}
          className={fieldClass}
          value={phone}
          onChange={(e) => onChange.phone(e.target.value)}
        />
      </div>
    </fieldset>
  );
}
