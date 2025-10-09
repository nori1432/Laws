import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 backdrop-blur-lg bg-black/40 border-t border-white/10 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img
                src="/logo.png"
                alt="Laws of Success Academy"
                className="w-12 h-12 rounded-lg shadow-lg"
              />
              <div>
                <span className="text-2xl font-bold text-white drop-shadow-lg">
                  Laws of Success
                </span>
                <div className="text-sm text-yellow-300 font-medium drop-shadow">
                  Academy
                </div>
              </div>
            </div>
            <p className="text-white/80 mb-6 max-w-md drop-shadow-sm leading-relaxed">
              Move UP in the World.
              Join our community of learners and discover your potential.
            </p>
            <div className="flex space-x-3">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/20">
                <Facebook className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/20">
                <Twitter className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/20">
                <Instagram className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/20">
                <Youtube className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4 drop-shadow">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-white/80 hover:text-white transition-colors duration-300 text-sm drop-shadow-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/home" className="text-white/80 hover:text-white transition-colors duration-300 text-sm drop-shadow-sm">
                  Laws of Success
                </Link>
              </li>
              <li>
                <Link to="/little-stars" className="text-white/80 hover:text-white transition-colors duration-300 text-sm drop-shadow-sm">
                  Little Stars
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-white/80 hover:text-white transition-colors duration-300 text-sm drop-shadow-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-white/80 hover:text-white transition-colors duration-300 text-sm drop-shadow-sm">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4 drop-shadow">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <span className="text-white/80 text-sm drop-shadow-sm leading-relaxed">
                  CENTRE COMMERCIAL SIRABAH<br />
                  (قيصارية سي رابح)<br />
                  Centre ville nedroma
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <div className="text-white/80 text-sm drop-shadow-sm">
                  <div>0791 19 74 30</div>
                  <div>+213 791 19 74 30</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <a href="mailto:successroadacademy@outlook.fr" className="text-white/80 hover:text-white transition-colors duration-300 text-sm drop-shadow-sm break-all">
                  successroadacademy@outlook.fr
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex justify-center items-center">
            <p className="text-white/70 text-sm drop-shadow-sm text-center">
              © {currentYear} Laws of Success Academy. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
