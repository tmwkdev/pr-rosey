#!/usr/bin/env node

import { createGreeting } from "./greeting.js";

const subject = process.argv.slice(2).join(" ") || "world";

console.log(createGreeting(subject));
