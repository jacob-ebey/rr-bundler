import * as React from "react";
import { Link, json, useLoaderData } from "react-router-dom";

export function loader() {
  return json({ message: "About :D" });
}

export default function HelloWorld() {
  const { message } = useLoaderData() as { message: string };
  const [count, setCount] = React.useState(0);

  return (
    <main>
      <h1>{message}</h1>
      <p>
        <button onClick={() => setCount((c) => c + 1)}>
          Increment: {count}
        </button>
      </p>
      <p>
        <Link to="/">Home</Link>
      </p>
    </main>
  );
}
