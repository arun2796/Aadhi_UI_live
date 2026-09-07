import React, { useState } from 'react';
import {
  Flame,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  Award,
  Send,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const AboutUsPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-orange uppercase tracking-wider">
          <Flame className="w-4 h-4" />
          <span>Heritage of Sivakasi Fireworks</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-navy">
          About AADHI CRACKERS
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Celebrating over 25 years of illuminating millions of Indian homes with premium, safe, and certified festive fireworks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <h2 className="text-xl font-bold text-navy">Our Sivakasi Story</h2>
          <p>
            Established in 1998 in the fireworks capital of India—Sivakasi, Tamil Nadu—<strong>AADHI CRACKERS</strong> began with a humble commitment: to produce sparklers and firecrackers that prioritize family safety, vivid colors, and authentic celebration.
          </p>
          <p>
            Today, we are an integrated pyrotechnics manufacturer and direct-to-consumer distributor serving retail customers, housing communities, and wholesale vendors across India.
          </p>
          <p>
            Every gift box and individual item is manufactured in strict compliance with the Petroleum and Explosives Safety Organisation (PESO) regulations.
          </p>
        </div>

        <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200 aspect-4/3 bg-slate-100">
          <img
            src="/product-placeholder.svg"
            alt="Sivakasi Fireworks"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <Award className="w-8 h-8 text-orange" />
          <h3 className="font-bold text-navy text-sm">Uncompromising Quality</h3>
          <p className="text-xs text-slate-500">
            Strict chemical purity standards for brilliant colors, higher ascent, and zero fuse misfires.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <ShieldCheck className="w-8 h-8 text-purple" />
          <h3 className="font-bold text-navy text-sm">Certified Green Pyros</h3>
          <p className="text-xs text-slate-500">
            Approved formulations engineered with lower particulate emissions and minimal noise.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <Flame className="w-8 h-8 text-gold-dark" />
          <h3 className="font-bold text-navy text-sm">Direct Wholesale Value</h3>
          <p className="text-xs text-slate-500">
            Bypassing middleman markups so families enjoy festival celebrations at honest factory prices.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ContactUsPage: React.FC = () => {
  const { showToast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    showToast('Your message has been sent to our Sivakasi team!', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black text-navy">
          Get in Touch with AADHI CRACKERS
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          Need assistance with retail orders, custom corporate gift boxes, or bulk wholesale booking? Our team is here to assist!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Info (5 cols) */}
        <div className="lg:col-span-5 bg-navy text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-card">
          <h2 className="text-xl font-bold text-gold">Contact Information</h2>

          <div className="space-y-4 text-xs">
            <div className="flex items-start space-x-3 text-slate-300">
              <MapPin className="w-5 h-5 text-orange flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Manufacturing & Dispatch Hub:</strong>
                124/B Sivakasi Main Road, Thiruthangal, Sivakasi, Tamil Nadu - 626130
              </div>
            </div>

            <div className="flex items-start space-x-3 text-slate-300">
              <Phone className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Phone / WhatsApp Support:</strong>
                +91 98765 43210 / +91 94433 12345
              </div>
            </div>

            <div className="flex items-start space-x-3 text-slate-300">
              <Mail className="w-5 h-5 text-purple-light flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Email Inquiries:</strong>
                support@aadhicrackers.com / sales@aadhicrackers.com
              </div>
            </div>

            <div className="flex items-start space-x-3 text-slate-300">
              <Clock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Business Hours:</strong>
                Monday – Saturday: 9:00 AM – 8:00 PM IST
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-navy">Message Received!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Thank you for contacting Aadhi Crackers. Our sales representative will get in touch with you within 2-4 business hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <h2 className="text-xl font-black text-navy">Send Us a Message</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Your Name *</label>
                  <input required type="text" placeholder="Ramesh Kumar" className="w-full px-3.5 py-2.5 rounded-xl border focus:ring-1 focus:ring-orange focus:outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                  <input required type="tel" placeholder="+91 98765 43210" className="w-full px-3.5 py-2.5 rounded-xl border focus:ring-1 focus:ring-orange focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address *</label>
                <input required type="email" placeholder="ramesh@example.com" className="w-full px-3.5 py-2.5 rounded-xl border focus:ring-1 focus:ring-orange focus:outline-none" />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Message / Inquiry Details *</label>
                <textarea required rows={4} placeholder="Tell us about your order or bulk quantity requirements..." className="w-full px-3.5 py-2.5 rounded-xl border focus:ring-1 focus:ring-orange focus:outline-none" />
              </div>

              <button
                type="submit"
                className="px-8 py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-glow"
              >
                <Send className="w-4 h-4" />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export const PolicyPage: React.FC<{ title: string; type: string }> = ({ title, type }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-black text-navy">{title}</h1>
      <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
        <p>
          Welcome to AADHI CRACKERS. We operate in full compliance with the Indian Explosives Act, 1884, and the Petroleum and Explosives Safety Organisation (PESO) guidelines.
        </p>
        <h3 className="font-bold text-navy text-sm pt-2">1. Dangerous Goods Regulations</h3>
        <p>
          All fireworks consignments are packaged in certified 5-ply corrugated containers marked with hazardous class labels. Dispatch is conducted strictly through licensed surface transport vehicles.
        </p>
        <h3 className="font-bold text-navy text-sm pt-2">2. Delivery Timelines</h3>
        <p>
          Standard delivery timeline across South India is 2-4 business days. North, West, and East India deliveries typically require 4-7 business days depending on PIN code accessibility.
        </p>
        <h3 className="font-bold text-navy text-sm pt-2">3. Cancellation & Damaged Goods</h3>
        <p>
          In the rare event of transit damage or missing items, please notify our customer care team with unboxing footage within 24 hours of package delivery for replacement or full refund processing.
        </p>
      </div>
    </div>
  );
};
