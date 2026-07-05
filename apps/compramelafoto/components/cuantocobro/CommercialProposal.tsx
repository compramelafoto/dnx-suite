"use client";

import type { CommercialProposalModel } from "@/lib/cuantocobro/commercial-proposal";
import { AtSign, Check, Globe, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  model: CommercialProposalModel;
  className?: string;
};

function contactIcon(label: string): ReactNode {
  const key = label.toLowerCase();
  const className = "cc-commercial-proposal__contact-icon";
  if (key.includes("email")) return <Mail className={className} aria-hidden />;
  if (key.includes("tel") || key.includes("whatsapp")) return <Phone className={className} aria-hidden />;
  if (key.includes("instagram")) return <AtSign className={className} aria-hidden />;
  if (key.includes("web")) return <Globe className={className} aria-hidden />;
  if (key.includes("dirección") || key.includes("direccion")) {
    return <MapPin className={className} aria-hidden />;
  }
  return <Phone className={className} aria-hidden />;
}

function splitConditionsLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function CommercialProposal({ model, className = "" }: Props) {
  const accentStyle = { "--cc-proposal-accent": model.accentColor } as CSSProperties;
  const conditionLines = splitConditionsLines(model.conditionsText);

  return (
    <article
      className={`cc-commercial-proposal ${className}`.trim()}
      style={accentStyle}
      aria-label={model.documentTitle}
    >
      <div className="cc-commercial-proposal__sheet">
        <header className="cc-commercial-proposal__header">
          <div className="cc-commercial-proposal__brand">
            {model.business.logoUrl ? (
              <div className="cc-commercial-proposal__logo">
                <Image
                  src={model.business.logoUrl}
                  alt={model.business.displayName || "Logo"}
                  width={180}
                  height={80}
                  className="cc-commercial-proposal__logo-img"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="cc-commercial-proposal__brand-text">
              {model.business.displayName ? (
                <p className="cc-commercial-proposal__brand-name m-0">{model.business.displayName}</p>
              ) : null}
              {model.business.responsibleName ? (
                <p className="cc-commercial-proposal__brand-sub m-0">{model.business.responsibleName}</p>
              ) : null}
              {model.business.contactLines.length > 0 ? (
                <ul className="cc-commercial-proposal__contact-list m-0 p-0 list-none">
                  {model.business.contactLines.map((line) => (
                    <li key={`${line.label}-${line.value}`} className="cc-commercial-proposal__contact-item">
                      {contactIcon(line.label)}
                      {line.href ? (
                        <a href={line.href} className="cc-commercial-proposal__contact-link">
                          {line.value}
                        </a>
                      ) : (
                        <span>{line.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="cc-commercial-proposal__title-block">
            <h1 className="cc-commercial-proposal__doc-title m-0">{model.documentTitle}</h1>
            {model.meta.length > 0 ? (
              <dl className="cc-commercial-proposal__meta m-0">
                {model.meta.map((item) => (
                  <div key={item.label} className="cc-commercial-proposal__meta-row">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </header>

        <section className="cc-commercial-proposal__letter" aria-labelledby="cc-proposal-intro">
          <h2 id="cc-proposal-intro" className="sr-only">
            Mensaje inicial
          </h2>
          <p className="cc-commercial-proposal__intro m-0">{model.introMessage}</p>
        </section>

        <section className="cc-commercial-proposal__includes-block" aria-labelledby="cc-proposal-includes">
          <h2 id="cc-proposal-includes" className="cc-commercial-proposal__includes-heading">
            {model.includesTitle}
          </h2>
          <ul className="cc-commercial-proposal__includes m-0 p-0 list-none">
            {model.includes.map((item) => (
              <li key={item.id} className="cc-commercial-proposal__include-item">
                <span className="cc-commercial-proposal__include-check" aria-hidden>
                  <Check strokeWidth={2.5} />
                </span>
                <div className="cc-commercial-proposal__include-body min-w-0">
                  <p className="cc-commercial-proposal__include-title m-0">{item.title}</p>
                  {item.description ? (
                    <p className="cc-commercial-proposal__include-desc m-0">{item.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="cc-commercial-proposal__investment" aria-labelledby="cc-proposal-investment">
          <h2 id="cc-proposal-investment" className="cc-commercial-proposal__investment-label m-0">
            {model.investmentLabel}
          </h2>
          <p className="cc-commercial-proposal__investment-amount m-0">{model.investmentAmount}</p>
          {model.paymentCards.length > 0 ? (
            <p className="cc-commercial-proposal__investment-hint m-0">
              Todas las opciones de pago disponibles
            </p>
          ) : null}
        </section>

        {model.paymentCards.length > 0 ? (
          <section className="cc-commercial-proposal__payment-block" aria-labelledby="cc-proposal-payment">
            <h2 id="cc-proposal-payment" className="cc-commercial-proposal__payment-heading">
              Formas de pago
            </h2>
            <div className="cc-commercial-proposal__payment-grid">
              {model.paymentCards.map((card) => (
                <article key={card.id} className="cc-commercial-proposal__payment-card">
                  <h3 className="cc-commercial-proposal__payment-title m-0">{card.title}</h3>
                  <p className="cc-commercial-proposal__payment-amount m-0">{card.amount}</p>
                  {card.subtitle ? (
                    <p className="cc-commercial-proposal__payment-subtitle m-0">{card.subtitle}</p>
                  ) : null}
                  {card.note ? (
                    <p className="cc-commercial-proposal__payment-note m-0 whitespace-pre-wrap">{card.note}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="cc-commercial-proposal__conditions-block" aria-labelledby="cc-proposal-conditions">
          <h2 id="cc-proposal-conditions" className="cc-commercial-proposal__conditions-heading">
            {model.conditionsTitle}
          </h2>
          {conditionLines.length > 1 ? (
            <ul className="cc-commercial-proposal__conditions-list m-0 p-0 list-none">
              {conditionLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="cc-commercial-proposal__conditions m-0 whitespace-pre-wrap">{model.conditionsText}</p>
          )}
        </section>

        <footer className="cc-commercial-proposal__footer">
          <p className="cc-commercial-proposal__closing m-0">{model.closingMessage}</p>
          <div className="cc-commercial-proposal__signature">
            <p className="cc-commercial-proposal__signature-name m-0">{model.signatureName}</p>
            {model.signatureContact ? (
              <p className="cc-commercial-proposal__signature-contact m-0">{model.signatureContact}</p>
            ) : null}
          </div>
        </footer>
      </div>
    </article>
  );
}
