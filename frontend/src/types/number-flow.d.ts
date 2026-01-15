declare global {
  namespace JSX {
    interface IntrinsicElements {
      'number-flow': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};
