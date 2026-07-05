"use client";

import CommercialPositioningStep from "@/components/cuantocobro/CommercialPositioningStep";
import CuantoCobroClientStep from "@/components/cuantocobro/CuantoCobroClientStep";
import QuoteItemsBuilder from "@/components/cuantocobro/QuoteItemsBuilder";
import InvestmentStep from "@/components/cuantocobro/InvestmentStep";
import AvailabilityStep from "@/components/cuantocobro/AvailabilityStep";
import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import MonthlyExpenseGroups from "@/components/cuantocobro/MonthlyExpenseGroups";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  CC_SAVINGS_GOALS_INTRO,
  CC_SAVINGS_GOALS_VS_PERSONAL_VACATIONS,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
  type CuantoCobroStepId,
} from "@/lib/cuantocobro/types";

type Props = {
  stepId: CuantoCobroStepId;
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(key: K, value: CuantoCobroProfileInput[K]) => void;
  onProfilePatch?: (patch: Partial<CuantoCobroProfileInput>) => void;
  onQuoteChange: <K extends keyof CuantoCobroQuoteInput>(key: K, value: CuantoCobroQuoteInput[K]) => void;
};

export default function CuantoCobroWizardStepContent({
  stepId,
  profile,
  quote,
  onProfileChange,
  onProfilePatch,
  onQuoteChange,
}: Props) {
  switch (stepId) {
    case "currency":
      return (
        <DsField label="Moneda principal" htmlFor="cc-currency">
          <Select
            id="cc-currency"
            value={profile.currency}
            onChange={(e) => onProfileChange("currency", e.target.value)}
          >
            <option value="">Seleccioná una moneda</option>
            <option value="ARS">Peso argentino (ARS)</option>
            <option value="USD">Dólar estadounidense (USD)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="MXN">Peso mexicano (MXN)</option>
            <option value="CLP">Peso chileno (CLP)</option>
            <option value="UYU">Peso uruguayo (UYU)</option>
          </Select>
        </DsField>
      );

    case "employment":
      return (
        <>
          <DsField label="¿Vivís solo de la fotografía?" htmlFor="cc-lives-only">
            <Select
              id="cc-lives-only"
              value={profile.livesOnlyFromPhotography}
              onChange={(e) =>
                onProfileChange("livesOnlyFromPhotography", e.target.value as CuantoCobroProfileInput["livesOnlyFromPhotography"])
              }
            >
              <option value="">Seleccioná una opción</option>
              <option value="yes">Sí, es mi única fuente de ingresos</option>
              <option value="no">No, tengo ingresos externos</option>
            </Select>
          </DsField>
          {profile.livesOnlyFromPhotography === "no" && (
            <DsField
              label="Ingresos externos mensuales"
              htmlFor="cc-external-income"
              hint="Ingresá el monto neto que recibís por fuera de la fotografía."
            >
              <CuantoCobroPriceInput
                id="cc-external-income"
                placeholder="Ej: 450.000"
                value={profile.externalMonthlyIncome}
                onValueChange={(value) => onProfileChange("externalMonthlyIncome", value)}
              />
            </DsField>
          )}
        </>
      );

    case "personal":
      return (
        <MonthlyExpenseGroups
          groups={profile.personalExpenseGroups}
          currency={profile.currency}
          onChange={(groups) => onProfileChange("personalExpenseGroups", groups)}
        />
      );

    case "business":
      return (
        <>
          <DsField label="Alquiler / estudio mensual" htmlFor="cc-business-rent">
            <CuantoCobroPriceInput
              id="cc-business-rent"
              placeholder="0 si trabajás desde casa"
              value={profile.businessRent}
              onValueChange={(value) => onProfileChange("businessRent", value)}
            />
          </DsField>
          <DsField label="Software y herramientas" htmlFor="cc-business-software">
            <CuantoCobroPriceInput
              id="cc-business-software"
              placeholder="Ej: 25.000"
              value={profile.businessSoftware}
              onValueChange={(value) => onProfileChange("businessSoftware", value)}
            />
          </DsField>
          <DsField label="Marketing y otros gastos fijos (opcional)" htmlFor="cc-business-marketing">
            <CuantoCobroPriceInput
              id="cc-business-marketing"
              placeholder="Opcional"
              value={profile.businessMarketing}
              onValueChange={(value) => onProfileChange("businessMarketing", value)}
            />
          </DsField>
        </>
      );

    case "team":
      return (
        <>
          <DsField label="Cantidad de empleados o colaboradores fijos" htmlFor="cc-employees-count" hint="Si trabajás solo, ingresá 0.">
            <Input
              id="cc-employees-count"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={profile.employeesCount}
              onChange={(e) => onProfileChange("employeesCount", e.target.value)}
            />
          </DsField>
          {(Number(profile.employeesCount) || 0) > 0 && (
            <DsField label="Costo mensual del equipo" htmlFor="cc-employee-cost">
              <CuantoCobroPriceInput
                id="cc-employee-cost"
                placeholder="Ej: 800.000"
                value={profile.employeeMonthlyCost}
                onValueChange={(value) => onProfileChange("employeeMonthlyCost", value)}
              />
            </DsField>
          )}
        </>
      );

    case "availability":
      return <AvailabilityStep profile={profile} onProfileChange={onProfileChange} />;

    case "investment":
      return (
        <InvestmentStep
          profile={profile}
          onProfileChange={onProfileChange}
          onProfilePatch={onProfilePatch}
        />
      );

    case "emergency-fund":
      return (
        <DsField
          label="Aporte mensual a fondo de emergencia"
          htmlFor="cc-emergency-fund"
          hint="Reserva para imprevistos personales o del negocio."
        >
          <CuantoCobroPriceInput
            id="cc-emergency-fund"
            placeholder="Ej: 30.000"
            value={profile.emergencyFundMonthly}
            onValueChange={(value) => onProfileChange("emergencyFundMonthly", value)}
          />
        </DsField>
      );

    case "savings-goals":
      return (
        <div className="ds-form-stack">
          <div className="ds-info-panel cc-info-panel--accent">
            <p className="ds-info-panel__body m-0 text-sm leading-relaxed">{CC_SAVINGS_GOALS_INTRO}</p>
          </div>
          <div className="ds-info-panel cc-info-panel--accent">
            <p className="ds-info-panel__body m-0 text-xs sm:text-sm leading-relaxed">
              {CC_SAVINGS_GOALS_VS_PERSONAL_VACATIONS}
            </p>
          </div>
          <DsField
            label="Aporte mensual para vacaciones y objetivos personales"
            htmlFor="cc-savings-goals"
            hint="Ej.: fondo para un viaje grande el año que viene, un curso o una meta familiar."
          >
            <CuantoCobroPriceInput
              id="cc-savings-goals"
              placeholder="Ej: 40.000"
              value={profile.savingsGoalsMonthly}
              onValueChange={(value) => onProfileChange("savingsGoalsMonthly", value)}
            />
          </DsField>
        </div>
      );

    case "commercial-positioning":
      return (
        <CommercialPositioningStep profile={profile} onProfileChange={onProfileChange} />
      );

    case "quote-details":
      return <CuantoCobroClientStep quote={quote} onQuoteChange={onQuoteChange} />;

    case "quote-items":
      return <QuoteItemsBuilder profile={profile} quote={quote} onQuoteChange={onQuoteChange} />;

    default:
      return null;
  }
}
