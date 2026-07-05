export type QuoteDenormalizedFields = {
  clientDisplayName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  jobLocation: string;
  jobType: string;
};

type QuoteClientShape = {
  name: string;
  company: string;
  email: string;
  phone: string;
  jobLocation: string;
  jobType: string;
};

export function extractQuoteDenormalizedFields(quote: { client: QuoteClientShape }): QuoteDenormalizedFields {
  const name = quote.client.name.trim();
  const company = quote.client.company.trim();

  return {
    clientDisplayName: [name, company].filter(Boolean).join(" · "),
    clientCompany: company,
    clientEmail: quote.client.email.trim(),
    clientPhone: quote.client.phone.trim(),
    jobLocation: quote.client.jobLocation.trim(),
    jobType: quote.client.jobType.trim(),
  };
}
