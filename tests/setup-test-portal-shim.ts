import React from "react";
import ReactDOM from "react-dom";

(globalThis as any).__TEST_ENV__ = true;

const mockElement = {
  nodeType: 1,
  appendChild: () => {},
  removeChild: () => {},
  setAttribute: () => {},
  style: {},
  clientWidth: 1024,
  clientHeight: 768,
};

const mockHead = {
  ...mockElement,
};

(globalThis as any).document = {
  head: mockHead,
  body: { ...mockElement },
  documentElement: { ...mockElement },
  createElement: () => ({ ...mockElement }),
  createTextNode: () => ({ ...mockElement }),
  getElementsByTagName: (tag: string) => (tag === "head" ? [mockHead] : []),
  getElementById: () => null,
};

(globalThis as any).window = {
  location: { hostname: "localhost", origin: "http://localhost:3000", pathname: "/" },
  addEventListener: () => {},
  removeEventListener: () => {},
  open: () => {},
  print: () => {},
  document: (globalThis as any).document,
  getComputedStyle: () => ({
    overflow: "",
    paddingRight: "0px",
    getPropertyValue: () => "",
  }),
};

const storageMap = new Map<string, string>();
const mockStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => { storageMap.set(k, String(v)); },
  removeItem: (k: string) => { storageMap.delete(k); },
  clear: () => { storageMap.clear(); },
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

(globalThis as any).localStorage = mockStorage;
(globalThis as any).window.localStorage = mockStorage;

(ReactDOM as any).createPortal = (children: any) => children;

const origUseState = React.useState;
(React as any).useState = (init: any) => {
  if (typeof init === "boolean" && init === false) return [true, () => {}];
  return origUseState(init);
};
