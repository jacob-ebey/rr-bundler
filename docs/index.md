# rr-bundler

A re-imagining of the Remix framework without file based conventions, or non-static based configuration.

What this means in a nutshell is your server can be ran without transpilation assuming your runtime supports all your import statements, and if your code is all shippable safely to the browser, even run there.

Is this optimized without transpilation? **No.** So how do we get there? We must have *some* conventions otherwise, how do we optimize?
