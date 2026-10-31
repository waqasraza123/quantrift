import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { getProductConfig } from "@/config/product";
import styles from "./auth.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  const product = getProductConfig();
  return (
    <div className={styles.page}>
      <a href="#account-form" className={styles.skip}>Skip to account form</a>
      <header className={`${styles.container} ${styles.header}`}>
        <Link href="/" aria-label={`${product.name} home`} className={styles.brand}>
          <BrandMark className="h-9 w-9" /><span>{product.name}</span>
        </Link>
        <Link href="/" className={styles.homeLink}>Back to home <span aria-hidden="true">↗</span></Link>
      </header>
      <main className={`${styles.container} ${styles.layout}`}>
        <section className={styles.story} aria-labelledby="auth-story-title">
          <p className={styles.eyebrow}>A CLEARER WAY TO RESEARCH.</p>
          <h1 id="auth-story-title">Your markets.<br /><span>A clearer<br /> perspective.</span></h1>
          <p>Less noise. More context. Keep your charts, trade ideas, and research together in one focused workspace.</p>
          <div className={styles.productMark}>
            <span><ProductIcon name="chart" className="h-7 w-7" /></span>
            <div>Meet {product.name}<small>Your market research workspace</small></div>
          </div>
          <ul>
            <li><ProductIcon name="check" />Follow the markets that matter to you.</li>
            <li><ProductIcon name="check" />Look closer at the evidence behind a setup.</li>
            <li><ProductIcon name="check" />Keep your notes and decisions in one place.</li>
          </ul>
        </section>
        <div id="account-form" tabIndex={-1} className={styles.formColumn}>{children}</div>
      </main>
      <footer className={`${styles.container} ${styles.footer}`}>Good research starts with a clearer view.</footer>
    </div>
  );
}
