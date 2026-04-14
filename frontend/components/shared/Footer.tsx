"use client";
import React, { useState } from "react";
import CustomButton from "../custom/CustomButton";
import FaqList from "@/components/shared/FaqList";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { Links } from "@/constant";
import Link from "next/link";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset messages
    setErrorMessage("");
    setSuccessMessage("");

    if (!email || !email.includes("@")) {
      setSubscribeStatus("error");
      setErrorMessage("Please enter a valid email address");
      setTimeout(() => {
        setSubscribeStatus("idle");
        setErrorMessage("");
      }, 4000);
      return;
    }

    setSubscribeStatus("loading");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            source: "footer",
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSubscribeStatus("success");
        // Check if already subscribed
        if (
          data.alreadySubscribed ||
          data.message === "Email is already subscribed"
        ) {
          setSuccessMessage(
            "You're already subscribed! Check your email for updates."
          );
        } else {
          setSuccessMessage(
            "Successfully subscribed! Please check your email for confirmation."
          );
        }
        setEmail("");
        setTimeout(() => {
          setSubscribeStatus("idle");
          setSuccessMessage("");
        }, 6000);
      } else {
        setSubscribeStatus("error");
        // Show specific error message from API
        const errorMsg =
          data.error ||
          data.message ||
          "Failed to subscribe. Please try again.";
        setErrorMessage(errorMsg);
        setTimeout(() => {
          setSubscribeStatus("idle");
          setErrorMessage("");
        }, 4000);
      }
    } catch (error) {
      console.error("Error subscribing email:", error);
      setSubscribeStatus("error");
      setErrorMessage(
        "Network error. Please check your connection and try again."
      );
      setTimeout(() => {
        setSubscribeStatus("idle");
        setErrorMessage("");
      }, 4000);
    }
  };

  return (
    <footer className="bg-primary layout  z-50 mb-10 h-auto min-h-[200px] w-full">
      <div className="flex flex-col md:flex-row justify-between items-start py-8 md:py-10 gap-8 md:gap-0">
        <div className="flex flex-col justify-center items-start  w-full md:w-[48%] h-full pb-8 md:pb-0 md:pr-6">
          <p className="text-white text-16 font-inter font-bold w-full">
            Still have questions? Enter your email address and an account
            executive will be in touch
          </p>
          <form
            onSubmit={handleNewsletterSubmit}
            className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 md:pt-10 w-full"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="bg-transparent border-b border-white w-full text-white placeholder:text-white placeholder:text-16 placeholder:font-inter pb-2 focus:outline-none focus:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              required
              disabled={subscribeStatus === "loading"}
            />
            <CustomButton
              title={subscribeStatus === "success" ? "Subscribed!" : "Join now"}
              loading={subscribeStatus === "loading"}
              loadingText="Subscribing..."
              className={`!bg-primary !text-white font-inter font-bold rounded-md w-full sm:w-1/2 mt-4 sm:mt-0 hover:!bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                subscribeStatus === "success" ? "!bg-green-500" : ""
              }`}
              type="submit"
              disabled={
                subscribeStatus === "loading" || subscribeStatus === "success"
              }
            />
          </form>
          {subscribeStatus === "error" && errorMessage && (
            <p className="text-red-300 text-sm mt-2 animate-pulse">
              {errorMessage}
            </p>
          )}
          {subscribeStatus === "success" && successMessage && (
            <p className="text-green-300 text-sm mt-2 font-medium">
              {successMessage}
            </p>
          )}
        </div>
        {/* <div className="w-full md:w-[52%] flex flex-col items-center md:items-end justify-center px-0 md:px-6">
          <p className="text-white text-16 font-inter font-bold mb-8 md:mb-10 text-center md:text-left max-w-full md:max-w-md w-full">
            If there are questions you want to ask, we will answer all your
            questions
          </p>
          <FaqList />
        </div> */}
      </div>
      <div className="w-full flex flex-col md:flex-row items-center justify-between py-5 border-t border-white gap-6 md:gap-0">
        <div className="flex items-center justify-center md:justify-start w-full md:w-[20%] gap-4 mb-4 md:mb-0">
          <a
            href="https://www.facebook.com/southern.sweet.sour"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-secondary transition-colors duration-300 cursor-pointer"
            aria-label="Facebook"
          >
            <Facebook className="text-24 w-6 h-6" />
          </a>
          <a
            href="https://www.instagram.com/southern.sweet.sour"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-secondary transition-colors duration-300 cursor-pointer"
            aria-label="Instagram"
          >
            <Instagram className="text-24 w-6 h-6" />
          </a>
          <a
            href="https://twitter.com/licorice4good"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-secondary transition-colors duration-300 cursor-pointer"
            aria-label="Twitter"
          >
            {/* <Twitter className="text-24 w-6 h-6" /> */}
          </a>
          <a
            href="https://www.linkedin.com/company/licorice4good"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-secondary transition-colors duration-300 cursor-pointer"
            aria-label="LinkedIn"
          >
            {/* <Linkedin className="text-24 w-6 h-6" /> */}
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center w-full md:w-[30%] gap-4 md:gap-8">
          {Links.map((link) => {
            return (
              <Link href={link.href} key={link.label} className="no-underline">
                <span
                  className="font-inter font-medium text-[14px]
                 leading-[150%] tracking-[0] transition-all duration-300 text-white
                 hover:text-secondary active:text-secondary focus:text-secondary
                 no-underline"
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col items-center md:items-end justify-center w-full md:w-[50%] mt-4 md:mt-0">
          <h6 className="text-white text-16 font-inter font-bold text-center md:text-right max-w-full md:max-w-md w-full">
            © Metaxoft All Rights Reserved
          </h6>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
