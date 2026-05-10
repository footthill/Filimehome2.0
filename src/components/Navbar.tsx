import React from 'react';
import { Home, Compass, Library, MessageCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Navbar() {
  const items = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Compass, label: 'Explore', path: '/search' },
    { icon: Library, label: 'Abasobanuzi', path: '/library' },
    { icon: MessageCircle, label: 'WhatsApp', path: '/chat', color: 'text-green-500' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-lg items-center justify-between rounded-2xl bg-[#121212]/95 px-2 py-3 backdrop-blur-xl border border-white/5 shadow-2xl">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-1.5 transition-all duration-300 relative",
                isActive ? (item.color || "text-yellow-500") : "text-gray-400 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-6 w-6", isActive && "scale-110")} />
                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
                {isActive && (
                  <div className={cn(
                    "absolute -bottom-2 w-1 h-1 rounded-full",
                    item.color ? "bg-green-500" : "bg-yellow-500"
                  )} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
