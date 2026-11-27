import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { CURRENCY, FAQ, PLANS } from "@/lib/constants";
import styles from "./Pricing.module.css";

export const metadata: Metadata = { title: "Pricing · Nonet" };

// Static page. Every plan button goes to "/" and does nothing else.
export default function PricingPage() {
  return (
    <div className={styles.screen}>
      <div className="page-head">
        <h1>Pricing</h1>
        <p>Playing and reviewing stay free. Pay to train smarter with a plan built from your own mistakes.</p>
      </div>

      <div className={styles.plans}>
        {PLANS.map((plan) => (
          <section
            key={plan.id}
            className={styles.plan}
            data-best={plan.bestValue || undefined}
            aria-labelledby={`plan-${plan.id}`}
          >
            <div className={styles.planHead}>
              {plan.bestValue ? (
                <span className={styles.best}>
                  <Pill tone="red">BEST VALUE</Pill>
                </span>
              ) : null}
              <h2 id={`plan-${plan.id}`} className={styles.planName}>
                {plan.name}
              </h2>
              <p className={styles.price}>
                <span className={styles.amount}>
                  {plan.price} {CURRENCY}
                </span>
                {plan.period ? <span className={styles.period}> {plan.period}</span> : null}
              </p>
              <p className={styles.note}>{plan.note}</p>
            </div>
            <ButtonLink href="/" variant={plan.primary ? "primary" : "secondary"} className={styles.cta}>
              {plan.cta}
            </ButtonLink>
            <ul className={styles.features}>
              {plan.features.map((f) => (
                <li key={f.label} data-included={f.included}>
                  <span className={styles.mark}>
                    <Glyph
                      name={f.included ? "check" : "dash"}
                      size={18}
                      strokeWidth={2.6}
                      label={f.included ? "Included" : "Not included"}
                    />
                  </span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className={styles.faq} aria-labelledby="faq-title">
        <h2 id="faq-title">Questions</h2>
        <dl>
          {FAQ.map((q) => (
            <div key={q.question} className={styles.faqItem}>
              <dt>{q.question}</dt>
              <dd>{q.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
