import { fs } from "memfs";

export const {
  promises: {
    appendFile,
    mkdir,
    open,
    writeFile,
    readFile,
  },
} = fs
