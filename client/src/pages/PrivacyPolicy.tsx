import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose prose-slate dark:prose-invert">
        <p className="text-lg mb-4">Last Updated: May 7, 2025</p>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Introduction</h2>
          <p>
            At VadisMedia, we respect your privacy and are committed to protecting your personal data. 
            This privacy policy explains how we collect, use, and safeguard your information when you use our 
            product placement analysis platform.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
          <p>We may collect several types of information, including:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Personal identification information (Name, email address, phone number)</li>
            <li>Company information</li>
            <li>Usage data (how you interact with our platform)</li>
            <li>Content you upload, including scripts and product information</li>
          </ul>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">How We Use Your Information</h2>
          <p>We use the collected data for various purposes:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>To provide and maintain our service</li>
            <li>To notify you about changes to our service</li>
            <li>To provide customer support</li>
            <li>To analyze and improve our service</li>
            <li>To detect, prevent and address technical issues</li>
          </ul>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Data Security</h2>
          <p>
            The security of your data is important to us. We implement appropriate technical and 
            organizational measures to protect your personal information. However, no method of 
            transmission over the Internet or electronic storage is 100% secure, so we cannot 
            guarantee absolute security.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Data Retention</h2>
          <p>
            We will retain your personal data only for as long as necessary to fulfill the purposes 
            we collected it for, including satisfying any legal, accounting, or reporting requirements.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Your Data Protection Rights</h2>
          <p>You have the following data protection rights:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>The right to access, update or delete your information</li>
            <li>The right to rectification</li>
            <li>The right to object to processing</li>
            <li>The right of restriction</li>
            <li>The right to data portability</li>
            <li>The right to withdraw consent</li>
          </ul>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please <Link href="/contact" className="text-primary hover:underline">contact us</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}