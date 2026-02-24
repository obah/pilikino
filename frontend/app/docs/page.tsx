import Link from "next/link";
import { Callout } from "nextra/components";

export default function DocsIndexPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">Pilikino Docs</h1>
      <p className="mt-4 text-lg text-neutral-700 dark:text-neutral-300">
        Pilikino is a privacy protocol for Starknet with a relayer-first SDK,
        Noir + Garaga proof flow, and Cairo contracts.
      </p>

      <Callout className="mt-6" type="info" emoji="⚡">
        SDK defaults are prewired: pool address, proof artifacts, and relayer
        URL.
      </Callout>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Start Here</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>
            <Link href="/docs/getting-started">Getting Started</Link>
          </li>
          <li>
            <Link href="/docs/core-sdk">Core SDK</Link>
          </li>
          <li>
            <Link href="/docs/hooks">React Hooks</Link>
          </li>
          <li>
            <Link href="/docs/deployments">Deployments</Link>
          </li>
          <li>
            <Link href="/docs/operators/join-relayer-network">
              Join Relayer Network
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
