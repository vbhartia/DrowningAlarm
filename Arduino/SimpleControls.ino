/*

Copyright (c) 2012-2014 RedBearLab

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

//"SPI.h/Nordic_nRF8001.h/ble_shield.h" are needed in every new project
#include <SPI.h>
#include <Nordic_nRF8001.h>
#include <ble_shield.h>

// Define input/output pins
#define INPUT_PIN A0			// Analog input pin
#define DI_RESET_BUTTON 2		// Digital Reset pin

//Alarm Output PIN
#define GREEN_LED 4 
#define RED_LED 5

boolean bBleConnected = false;
boolean bInitialConnect = false;
boolean bAlarm = false;
int bAlarmCounter = 0;
int alarmFlashRate = 500;

// This function is called only once, at reset.
void setup() 
{
	
	// Setup Reset pin as input	
	pinMode(DI_RESET_BUTTON, INPUT);  
	
	// Enable output.
	pinMode(GREEN_LED, OUTPUT);
	pinMode(RED_LED, OUTPUT);

	// Default pins set to 9 and 8 for REQN and RDYN
	// Set your REQN and RDYN here before ble_begin() if you need
	//ble_set_pins(3, 2);

	// Initialize BLE library.
	ble_begin();
	
	// Enable serial debug.
	Serial.begin(57600);
	
	// Initial conditions
	bBleConnected = false;
	bInitialConnect = false;
	
	// Turn ON LED.
	digitalWrite(GREEN_LED, HIGH);
	digitalWrite(RED_LED, HIGH);
	
	delay(1000);
	
	digitalWrite(GREEN_LED, LOW);
	digitalWrite(RED_LED, LOW);

}

// This function is called continuously, after setup() completes.
void loop() 
{
	// If there's any input..		

	if (digitalRead(DI_RESET_BUTTON))
	{
		bBleConnected = false;
		bAlarm = false;
		bInitialConnect == false;
		digitalWrite(GREEN_LED, LOW);
		digitalWrite(RED_LED, HIGH);
		
	}

	if(bBleConnected)
	{
		digitalWrite(GREEN_LED, HIGH);
		digitalWrite(RED_LED, LOW);
		
	}
	else
	{
		digitalWrite(GREEN_LED, LOW);
		digitalWrite(RED_LED, HIGH);
	}

	if (ble_connected())
	{
		bBleConnected = true;
		bInitialConnect = true;
	}
	else
	{
		// Connection is lost, but previously it was established, set off alarm
		bBleConnected = false;
		if (bInitialConnect == true)
		{
			// set off alarm
			bAlarm = true;
			alarmFlashRate = 500;
		}
	}
	
	if(bAlarm)
	{
		if (bAlarmCounter < alarmFlashRate)
		{
			digitalWrite(GREEN_LED, HIGH);
			digitalWrite(RED_LED, LOW);
			
			
		}
		else
		{
			digitalWrite(GREEN_LED, LOW);
			digitalWrite(RED_LED, HIGH);	
			
		}
		
		if(bAlarmCounter > alarmFlashRate*2)
		{
			
			bAlarmCounter = 0;
		}
		else
		{
			bAlarmCounter++;
			
		}
	}
	
	// Connect to device
	// Read Input from app to set off alarm
     while(ble_available())
     {
          int c = ble_read();
         
          if(c != 0)
          {
               bAlarm = true;
               alarmFlashRate = 3;
          }
          else
          {
               // Input value zero means "turn off LED".
              
               bAlarm = false;
          }
     }
     
     
     // Read the analog input pin and send the data over BLE.
     short i = analogRead(INPUT_PIN);
    
     ble_write_bytes((byte*)&i, 2);
    

	ble_do_events();
}

