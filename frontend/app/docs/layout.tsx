import type { ReactNode } from "react";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: "Pilikino Docs",
  description: "Developer and operator documentation for Pilikino",
};

const banner = (
  <Banner storageKey="pilikino-docs-banner">
    Pilikino SDK ships with default pool, proving artifacts, and relayer endpoint.
  </Banner>
);

const navbar = <Navbar logo={<b>Pilikino Docs</b>} />;

const footer = (
  <Footer>{new Date().getFullYear()} © Pilikino. All rights reserved.</Footer>
);

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Head />
      <Layout banner={banner} navbar={navbar} pageMap={await getPageMap()} footer={footer}>
        {children}
      </Layout>
    </>
  );
}
