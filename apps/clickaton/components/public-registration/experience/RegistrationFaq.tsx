import { registrationExperienceFaq } from "@/content/registration-experience-faq";

export function RegistrationFaq() {
  const { title, items } = registrationExperienceFaq;

  return (
    <section className="space-y-6" aria-labelledby="registration-faq-title">
      <h2 id="registration-faq-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h2>
      <div className="divide-y divide-ck-border border-y border-ck-border">
        {items.map((item) => (
          <details key={item.question} className="group py-5">
            <summary className="cursor-pointer list-none marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ck-yellow [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4 text-base font-semibold text-ck-text md:text-lg">
                <span>{item.question}</span>
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center border border-ck-yellow/60 text-sm font-bold text-ck-yellow transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-4 max-w-prose pr-8 text-sm leading-relaxed text-ck-text-secondary md:text-base">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
