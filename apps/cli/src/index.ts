#!/usr/bin/env node

import { createGreeting } from "@pr-rosey/shared";

const subject = process.argv.slice(2).join(" ") || "world";

console.log(createGreeting(subject));
