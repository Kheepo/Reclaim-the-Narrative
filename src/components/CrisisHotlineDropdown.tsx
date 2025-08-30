import React, { useState } from 'react';
import { ChevronDownIcon, PhoneIcon } from '@heroicons/react/24/outline';

interface EmergencyContact {
  name: string;
  number: string;
  description?: string;
}

interface CountryData {
  name: string;
  code: string;
  contacts: EmergencyContact[];
}

const crisisHotlines: CountryData[] = [
  {
    name: 'Australia',
    code: 'AU',
    contacts: [
      { name: 'Lifeline', number: '13 11 14', description: '24/7 crisis support' },
      { name: 'Emergency Services', number: '000', description: 'Police, Fire, Ambulance' },
      { name: '1800RESPECT', number: '1800 737 732', description: 'Sexual assault, domestic violence' }
    ]
  },
  {
    name: 'Canada',
    code: 'CA',
    contacts: [
      { name: 'Crisis Services Canada', number: '1-833-456-4566', description: '24/7 crisis support' },
      { name: 'Emergency Services', number: '911', description: 'Police, Fire, Ambulance' },
      { name: 'Kids Help Phone', number: '1-800-668-6868', description: 'Youth support' }
    ]
  },
  {
    name: 'France',
    code: 'FR',
    contacts: [
      { name: 'SOS Amitié', number: '09 72 39 40 50', description: '24/7 emotional support' },
      { name: 'Emergency Services', number: '112', description: 'European emergency number' },
      { name: 'Violences Femmes Info', number: '3919', description: 'Violence against women' }
    ]
  },
  {
    name: 'Germany',
    code: 'DE',
    contacts: [
      { name: 'Telefonseelsorge', number: '0800 111 0 111', description: '24/7 crisis support' },
      { name: 'Emergency Services', number: '112', description: 'Police, Fire, Ambulance' },
      { name: 'Hilfetelefon', number: '08000 116 016', description: 'Violence against women' }
    ]
  },
  {
    name: 'India',
    code: 'IN',
    contacts: [
      { name: 'AASRA', number: '91-22-27546669', description: '24/7 crisis support' },
      { name: 'Emergency Services', number: '112', description: 'Police, Fire, Ambulance' },
      { name: 'Women Helpline', number: '1091', description: 'Women in distress' }
    ]
  },
  {
    name: 'Japan',
    code: 'JP',
    contacts: [
      { name: 'TELL Lifeline', number: '03-5774-0992', description: '24/7 crisis support (English)' },
      { name: 'Emergency Services', number: '110/119', description: 'Police (110), Fire/Ambulance (119)' },
      { name: 'DV Hotline', number: '0570-0-55210', description: 'Domestic violence support' }
    ]
  },
  {
    name: 'South Africa',
    code: 'ZA',
    contacts: [
      { name: 'SADAG', number: '0800 567 567', description: '24/7 mental health support' },
      { name: 'Emergency Services', number: '10111', description: 'Police emergency' },
      { name: 'GBV Command Centre', number: '0800 428 428', description: 'Gender-based violence' }
    ]
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    contacts: [
      { name: 'Samaritans', number: '116 123', description: '24/7 crisis support' },
      { name: 'Emergency Services', number: '999', description: 'Police, Fire, Ambulance' },
      { name: 'National Domestic Violence Helpline', number: '0808 2000 247', description: '24/7 domestic violence support' }
    ]
  },
  {
    name: 'United States',
    code: 'US',
    contacts: [
      { name: '988 Suicide & Crisis Lifeline', number: '988', description: '24/7 crisis support' },
      { name: 'Emergency Services', number: '911', description: 'Police, Fire, Ambulance' },
      { name: 'National Domestic Violence Hotline', number: '1-800-799-7233', description: '24/7 domestic violence support' },
      { name: 'RAINN National Sexual Assault Hotline', number: '1-800-656-4673', description: 'Sexual assault support' }
    ]
  }
];

const CrisisHotlineDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [showContacts, setShowContacts] = useState(false);

  const handleCountrySelect = (country: CountryData) => {
    setSelectedCountry(country);
    setShowContacts(true);
    setIsOpen(false);
  };

  const handleBackToCountries = () => {
    setShowContacts(false);
    setSelectedCountry(null);
    setIsOpen(true);
  };

  return (
    <div className="relative">
      {/* Main Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowContacts(false);
          setSelectedCountry(null);
        }}
        className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 shadow-lg"
        aria-label="Crisis Hotlines"
      >
        <PhoneIcon className="h-5 w-5" />
        <span className="font-medium">Crisis Hotlines</span>
        <ChevronDownIcon 
          className={`h-4 w-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {(isOpen || showContacts) && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          {!showContacts ? (
            /* Country Selection */
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Select Your Country
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {crisisHotlines.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => handleCountrySelect(country)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-150"
                  >
                    <span className="font-medium">{country.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Emergency Contacts Display */
            selectedCountry && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCountry.name} - Emergency Contacts
                  </h3>
                  <button
                    onClick={handleBackToCountries}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ← Back
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedCountry.contacts.map((contact, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {contact.name}
                          </h4>
                          {contact.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {contact.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <a
                          href={`tel:${contact.number}`}
                          className="inline-flex items-center space-x-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors duration-200"
                        >
                          <PhoneIcon className="h-4 w-4" />
                          <span className="font-mono">{contact.number}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Emergency:</strong> If you are in immediate danger, contact your local emergency services immediately.
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {(isOpen || showContacts) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setShowContacts(false);
            setSelectedCountry(null);
          }}
        />
      )}
    </div>
  );
};

export default CrisisHotlineDropdown;