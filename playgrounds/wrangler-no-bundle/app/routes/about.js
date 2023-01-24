import * as React from "react";
import { html } from "htm/react";
import { Link, json, useLoaderData } from "react-router-dom";

export function loader() {
  return json({ message: "About :D" });
}

export default function About() {
  /** @type {{ message: string }} */
  const { message } = useLoaderData();
  const [count, setCount] = React.useState(0);

  return html`
    <main>
      <h1>${message}</h1>
      <p>
        <button onClick=${() => setCount(count + 1)}>
          Increment: ${count}
        </button>
      </p>
      <${Link} to="/">Home</${Link}>
    </main>
  `;
}
