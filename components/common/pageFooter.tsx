import React from "react";

const PageFooter = () => {
  return (
    <footer className="py-4 text-center text-sm text-muted-foreground w-full max-w-4xl">
      Created by{" "}
      <a
        href="https://github.com/fuuurma"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-primary"
      >
        @fuuurma
      </a>
    </footer>
  );
};

export default PageFooter;
