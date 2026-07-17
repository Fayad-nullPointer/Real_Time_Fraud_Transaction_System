import os
import logging
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger("twilio_notifier")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

class WhatsAppNotifier:
    """
    Handles sending WhatsApp OTPs and fraud alerts via Twilio.
    Ensure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set in your .env file.
    """
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")

        if not self.account_sid or not self.auth_token:
            logger.warning("Twilio credentials missing in .env. WhatsApp alerts will fail or be skipped.")
            self.client = None
        else:
            self.client = Client(self.account_sid, self.auth_token)

    def send_fraud_alert(self, to_phone_number: str, transaction_id: str, tx_amount: float, terminal_id: str):
        """
        Sends a WhatsApp message to the user asking them to confirm a suspicious transaction with an OTP.
        """
        if not self.client:
            logger.error("Cannot send WhatsApp message: Twilio client not initialized.")
            return None

        # Format the phone number properly for Twilio's WhatsApp API
        if not to_phone_number.startswith("whatsapp:"):
            to_phone_number = f"whatsapp:{to_phone_number}"

        import random
        otp = str(random.randint(100000, 999999))

        message_body = (
            f"🚨 *URGENT SECURITY ALERT* 🚨\n\n"
            f"We suspended a suspicious transaction of *${tx_amount:.2f}* at Terminal *{terminal_id}* (TX ID: {transaction_id}).\n\n"
            f"Your verification code is: *{otp}*\n\n"
            f"Please enter this OTP in your app to approve the transaction."
        )

        try:
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=to_phone_number
            )
            logger.info(f"WhatsApp fraud alert sent to {to_phone_number}. Message SID: {message.sid}")
            return otp
        except TwilioRestException as e:
            logger.error(f"Failed to send WhatsApp message: {e}")
            return None

# Smoke test
if __name__ == "__main__":
    notifier = WhatsAppNotifier()
    # To test this, replace the number below with your verified Twilio Sandbox number
    # notifier.send_fraud_alert("+1234567890", "TX-999", 189.50, "T-917")
