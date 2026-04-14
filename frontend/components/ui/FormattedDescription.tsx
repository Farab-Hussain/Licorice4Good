"use client";
import React from "react";

interface FormattedDescriptionProps {
  description: string | null | undefined;
  className?: string;
}

const FormattedDescription: React.FC<FormattedDescriptionProps> = ({
  description,
  className = "",
}) => {
  if (!description) return null;

  // Format description with support for headings and bullet points while preserving all line breaks
  const formatDescription = (text: string): React.ReactNode => {
    const lines = text.split("\n");
    const result: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listKey = 0;

    const flushList = () => {
      if (currentList.length > 0) {
        result.push(
          <ul
            key={`list-${listKey++}`}
            className="list-disc list-inside space-y-1 my-2 ml-4"
          >
            {currentList.map((item, idx) => (
              <li key={idx} className="text-gray-700">
                {item}
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const isLastLine = index === lines.length - 1;

      // Empty line - flush list and add line break
      if (trimmedLine === "") {
        flushList();
        if (!isLastLine) {
          result.push(<div key={`empty-${index}`} className="h-2"></div>);
        }
        return;
      }

      // Heading level 2 (## Heading)
      if (trimmedLine.startsWith("## ")) {
        flushList();
        const headingText = trimmedLine.substring(3).trim();
        result.push(
          <h3
            key={`h2-${index}`}
            className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0"
          >
            {headingText}
          </h3>
        );
        return;
      }

      // Heading level 3 (### Subheading)
      if (trimmedLine.startsWith("### ")) {
        flushList();
        const headingText = trimmedLine.substring(4).trim();
        result.push(
          <h4
            key={`h3-${index}`}
            className="text-base font-semibold text-gray-800 mt-3 mb-2"
          >
            {headingText}
          </h4>
        );
        return;
      }

      // Bullet point (- or *)
      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
        const bulletText = trimmedLine.substring(2).trim();
        currentList.push(bulletText);
        return;
      }

      // Regular text - display exactly as written
      flushList();
      result.push(
        <div key={`text-${index}`} className="text-gray-700 mb-1">
          {line}
        </div>
      );
    });

    // Flush any remaining list items
    flushList();

    return <>{result}</>;
  };

  return (
    <div
      className={`formatted-description ${className} text-gray-700 leading-relaxed`}
    >
      {formatDescription(description)}
    </div>
  );
};

export default FormattedDescription;
