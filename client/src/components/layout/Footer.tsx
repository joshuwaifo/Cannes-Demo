import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-secondary text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm">&copy; {new Date().getFullYear()} ScriptBrand. All rights reserved.</p>
          </div>
          <div className="flex space-x-4">
            <Link href="#" className="text-sm text-gray-300 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="text-sm text-gray-300 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="#" className="text-sm text-gray-300 hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
