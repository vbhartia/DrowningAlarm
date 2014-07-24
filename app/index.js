// JavaScript code for the Arduino BLE example app.

/**
 * The BLE plugin is loaded asynchronously so the ble
 * variable is set in the onDeviceReady handler.
 */
var ble = null;

/**
 * Called when HTML page has been loaded.
 */
$(document).ready( function()
{
	// Adjust canvas size when browser resizes
	$(window).resize( respondCanvas );

	// Adjust the canvas size when the document has loaded.
	respondCanvas();
});

function startDevice() 
{
	$('#splashScreen').css("display", "none");
	$('#deviceConnection').css("display", "inline");

	app.initialize();

}

function connectionStatus(status)
{
	if (status == 'connecting')
	{
		$('#connectionStatusText').text("Connecting ...")
		$('#connectionStatus').css("background-color", "yellow")
	}
	else if (status == 'connected')
	{
		$('#connectionStatusText').text("Connected!")
		$('#connectionStatus').css("background-color", "green")
	}
	else if (status == 'error')
	{
		$('#connectionStatusText').text("Error!")
		$('#connectionStatus').css("background-color", "red")
	}


}


/**
 * Adjust the canvas dimensions based on its container's dimensions.
 */
function respondCanvas()
{
	var canvas = $('#canvas');
	var container = $(canvas).parent();
	canvas.attr('width', $(container).width() ); // Max width
	canvas.attr('height', $(container).height() ); // Max height
}

/**
 * Application object that holds data and functions used by the app.
 */
var app =
{
	// Discovered devices.
	knownDevices: {},

	// Reference to the device we are connecting to.
	connectee: null,

	// Handle to the connected device.
	deviceHandle: null,

	// Handles to characteristics and descriptor for reading and
	// writing data from/to the Arduino using the BLE shield.
	characteristicRead: null,
	characteristicWrite: null,
	descriptorNotification: null,

	// Data that is plotted on the canvas.
	dataPoints: [],

	alarmCount: 0,
	alarmThreshold: 150,

	alarmFunctionCount: 0,
	alarmBoolean: false,

	alarmON: false,

	scanningCount: 0,



	initialize: function()
	{
		document.addEventListener('deviceready', app.onDeviceReady, false);

		// Important reset BLE when page reloads/closes!
		window.hyper && window.hyper.onReload(function()
		{
			evothings.ble.stopScan();
			if (app.deviceHandle)
			{
				evothings.ble.close(app.deviceHandle);
			}
		});

		app.alarmCount = 0;
		$('#thresholdInput').val(app.alarmThreshold)

	},

	// Called when device plugin functions are ready for use.
	onDeviceReady: function()
	{
		ble = evothings.ble; // Evothings BLE plugin
		app.startScan();
	},

	startScan: function()
	{
		console.log('Scanning...');

		connectionStatus('connecting')
		//app.scanningCount++
		// Device disconnected

		evothings.ble.startScan(
			function(deviceInfo)
			{
				if (app.knownDevices[deviceInfo.address])
				{
					return;
				}
				console.log('found device: ' + deviceInfo.name);
				app.knownDevices[deviceInfo.address] = deviceInfo;
				if (deviceInfo.name == 'BLE Shield' && !app.connectee)
				{
					console.log('Found BLE shield');
					connectee = deviceInfo;
					app.connect(deviceInfo.address);
				}
			},
			function(errorCode)
			{
				console.log('startScan error: ' + errorCode);
			});
	},

	connect: function(address)
	{
		evothings.ble.stopScan();
		console.log('Connecting...');
		connectionStatus('connecting')

		app.scanningCount++

		evothings.ble.connect(
			address,
			function(connectInfo)
			{
				if (connectInfo.state == 2) // Connected
				{
					console.log('Connected');
					connectionStatus('connected')

					$('#deviceTitle').text(connectInfo.deviceHandle)

					app.deviceHandle = connectInfo.deviceHandle;
					app.getServices(connectInfo.deviceHandle);
				}
			},
			function(errorCode)
			{
				console.log('connect error: ' + errorCode);
				connectionStatus('error')
			});
	},

	on: function()
	{
		app.write(
			'writeCharacteristic',
			app.deviceHandle,
			app.characteristicWrite,
			new Uint8Array([1])); // 1 = on
	},

	off: function()
	{
		app.write(
			'writeCharacteristic',
			app.deviceHandle,
			app.characteristicWrite,
			new Uint8Array([0])); // 0 = off
	},

	write: function(writeFunc, deviceHandle, handle, value)
	{
		if (handle)
		{
			ble[writeFunc](
				deviceHandle,
				handle,
				value,
				function()
				{
					console.log(writeFunc + ': ' + handle + ' success.');
				},
				function(errorCode)
				{
					console.log(writeFunc + ': ' + handle + ' error: ' + errorCode);
				});
		}
	},

	startReading: function(deviceHandle)
	{
		console.log('Enabling notifications');

		// Turn notifications on.
		app.write(
			'writeDescriptor',
			deviceHandle,
			app.descriptorNotification,
			new Uint8Array([1,0]));

		// Start reading notifications.
		evothings.ble.enableNotification(
			deviceHandle,
			app.characteristicRead,
			function(data)
			{
				app.drawLines([new DataView(data).getUint16(0, true)]);


			},
			function(errorCode)
			{
				console.log('enableNotification error: ' + errorCode);
			});
	},

	drawLines: function(dataArray)
	{
		var canvas = document.getElementById('canvas');
		var context = canvas.getContext('2d');
		var dataPoints = app.dataPoints;

		dataPoints.push(dataArray);
		if (dataPoints.length > canvas.width)
		{
			dataPoints.splice(0, (dataPoints.length - canvas.width));
		}

		var magnitude = 1024;

		function calcY(i)
		{
			var return_value = ((i * canvas.height) / (magnitude * 2)) + (canvas.height / 2);

			return return_value
		}

		function drawLine(offset, color)
		{
			context.strokeStyle = color;
			context.beginPath();
			context.moveTo(0, calcY(dataPoints[dataPoints.length-1][offset]));
			var x = 1;
			for (var i = dataPoints.length - 2; i >= 0; i--)
			{
				var y = calcY(dataPoints[i][offset]);
				context.lineTo(x, y);
				x++;
				

			}
			context.stroke();
		}

		context.clearRect(0, 0, canvas.width, canvas.height);
		drawLine(0, '#f00');

		
		calculateAverageAndAlarm()

		function calculateAverageAndAlarm()
		{
			$("#recentDeviceVoltage").text(dataPoints[dataPoints.length-1])
			$("#laggingDeviceVoltage").text(dataPoints[dataPoints.length-30])
			$("#alarmCount").text(app.alarmCount)	

			if (dataPoints[dataPoints.length-1] > 900 && dataPoints[dataPoints.length-30] > 900)
			{
				app.alarmCount++;
			}
			else
			{
				app.alarmCount = 0;

			}


		}

		app.alarmThreshold = $('#thresholdInput').val()

		if(app.scanningCount > 1)
		{
			app.alarmBoolean = true;
			app.playAlarm = true;

		}


		if (app.alarmCount > app.alarmThreshold || app.alarmON)
		{

			//sets off alarm
			app.alarmBoolean = true;
			app.playAlarm = true;
			app.on()
			app.alarmCount = 0;



		}

		if (app.alarmBoolean == true)
		{

			$('#alarmFunctionCount').text(app.alarmFunctionCount)

			if (app.alarmFunctionCount > 5)
			{
				$('body').css('background-color', 'green')

			}
			else
			{
				$('body').css('background-color', 'red')

			}

			if (app.alarmFunctionCount > 10)
			{

				app.alarmFunctionCount = 0;

			}
			else
			{
				app.alarmFunctionCount++;

			}

			if (app.alarmCount%37 == 0 && app.playAlarm)
			{

				app.playAlarm = false;
				navigator.notification.beep(1)

			}


		}

	},

	getServices: function(deviceHandle)
	{
		console.log('Reading services...');

		evothings.ble.readAllServiceData(deviceHandle, function(services)
		{
			// Find handles for characteristics and descriptor needed.
			for (var si in services)
			{
				var service = services[si];

				for (var ci in service.characteristics)
				{
					var characteristic = service.characteristics[ci];

					if (characteristic.uuid == '713d0002-503e-4c75-ba94-3148f18d941e')
					{
						app.characteristicRead = characteristic.handle;
					}
					else if (characteristic.uuid == '713d0003-503e-4c75-ba94-3148f18d941e')
					{
						app.characteristicWrite = characteristic.handle;
					}

					for (var di in characteristic.descriptors)
					{
						var descriptor = characteristic.descriptors[di];

						if (characteristic.uuid == '713d0002-503e-4c75-ba94-3148f18d941e' &&
							descriptor.uuid == '00002902-0000-1000-8000-00805f9b34fb')
						{
							app.descriptorNotification = descriptor.handle;
						}
					}
				}
			}

			if (app.characteristicRead && app.characteristicWrite && app.descriptorNotification)
			{
				console.log('RX/TX services found.');
				app.startReading(deviceHandle);
			}
			else
			{
				console.log('ERROR: RX/TX services not found!');
			}
		},
		function(errorCode)
		{
			console.log('readAllServiceData error: ' + errorCode);
		});
	},
};
// End of app object.
