// client/src/components/layout/Footer.tsx
import { Link } from "wouter";

export default function Footer() {
  return (
    // Use the custom --vadis-purple for the background, defined in index.css and tailwind.config.ts
    // Keep text-white as the screenshot footer has white text on purple.
    <footer className="bg-vadis-purple text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            {/* Text color is inherited from 'text-white' on the footer element */}
            <p className="text-sm">
              © {new Date().getFullYear()} Vadis Media AG. All rights reserved.
            </p>
          </div>
          <div className="flex space-x-4">
            {/* Link text color needs to be visible on purple. Default 'text-white' is good.
                Hover state can remain white or be a slightly lighter shade if needed, but text-white is clear.
                The original text-gray-300 was for a dark (secondary) background, not the vadis-purple.
            */}
            <Link
              href="/privacy-policy"
              className="text-sm text-gray-200 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-sm text-gray-200 hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="text-sm text-gray-200 hover:text-white transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
