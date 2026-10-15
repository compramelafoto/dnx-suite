"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Link from "next/link";
import { FAQ_CATEGORIES } from "@/components/faq-data";

export { FAQ_CATEGORIES };
export type { FaqCategory } from "@/components/faq-data";

export default function FaqSection() {
  const [openCategoryIndex, setOpenCategoryIndex] = useState<number | null>(null);
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  const handleToggleCategory = (index: number) => {
    setOpenCategoryIndex((prev) => (prev === index ? null : index));
    setOpenQuestionIndex(null);
  };

  const handleToggleQuestion = (index: number) => {
    setOpenQuestionIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section id="faq" className="section-spacing bg-white">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-3">
              Preguntas frecuentes
            </h2>
            <p className="text-lg text-[#6b7280]">
              Respondemos las dudas más comunes sobre la plataforma.
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_CATEGORIES.map((category, categoryIndex) => {
              const isCategoryOpen = openCategoryIndex === categoryIndex;
              const categoryPanelId = `faq-category-panel-${categoryIndex}`;
              return (
                <Card key={category.title} className="border border-[#e5e7eb]">
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 flex items-center justify-between"
                    aria-expanded={isCategoryOpen}
                    aria-controls={categoryPanelId}
                    onClick={() => handleToggleCategory(categoryIndex)}
                  >
                    <h3 className="text-base md:text-lg font-semibold text-[#111827]">
                      {category.title}
                    </h3>
                    <span className="text-[#6b7280] text-xl">
                      {isCategoryOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isCategoryOpen && (
                    <div id={categoryPanelId} className="px-5 pb-5">
                      <div className="space-y-3">
                        {category.items.map((item, questionIndex) => {
                          const isQuestionOpen = openQuestionIndex === questionIndex;
                          const questionPanelId = `faq-question-panel-${categoryIndex}-${questionIndex}`;
                          return (
                            <div
                              key={`${categoryIndex}-${questionIndex}`}
                              className="border border-[#e5e7eb] rounded-xl"
                            >
                              <button
                                type="button"
                                className="w-full text-left px-4 py-3 flex items-center justify-between"
                                aria-expanded={isQuestionOpen}
                                aria-controls={questionPanelId}
                                onClick={() => handleToggleQuestion(questionIndex)}
                              >
                                <span className="text-sm md:text-base font-medium text-[#1a1a1a]">
                                  {item.q}
                                </span>
                                <span className="text-[#6b7280] text-lg">
                                  {isQuestionOpen ? "−" : "+"}
                                </span>
                              </button>
                              {isQuestionOpen && (
                                <div
                                  id={questionPanelId}
                                  className="px-4 pb-4 text-sm text-[#4b5563]"
                                >
                                  {item.a}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Card className="inline-block px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb]">
              <p className="text-sm md:text-base text-[#1a1a1a]">
                ¿Te quedó alguna duda?{" "}
                <Link href="/#contacto" className="text-[#c27b3d] font-semibold underline">
                  Escribinos
                </Link>
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
