const express = require('express');
const axios = require('axios');
const { subHours, formatISO } = require('date-fns');
const fs = require('fs');

const app = express();
app.use(express.json());

app.post('/simulate', async (req, res) => {
    const { target_url, carrier, tracking_number, status } = req.body;

    const templatePath = `./payloads/${carrier}.json`;
    if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ error: `Template for ${carrier} not found.` });
    }
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    // 1. Find target status
    const startIndex = template.data.events.findIndex(e => e.status_code === status);
    if (startIndex === -1) {
        return res.status(400).json({ error: `Status ${status} not found.` });
    }

    // 2. Slice history (Newest to Oldest)
    const historyEvents = template.data.events.slice(startIndex);
    const now = new Date();
    const mostRecentOffset = historyEvents[0].hour_offset;

    // 3. Map events with BOTH timestamps and original metadata
    const processedEvents = historyEvents.map(event => {
        const hoursDiff = Math.abs(event.hour_offset - mostRecentOffset);
        const eventTime = subHours(now, hoursDiff);

        // Remove the internal helper but keep everything else
        const { hour_offset, ...cleanEvent } = event;

        return {
            ...cleanEvent,
            occurred_at: formatISO(eventTime),
            carrier_occurred_at: formatISO(eventTime).split('Z')[0]
        };
    });

    // 4. Date Logic for Top Level Fields
    const shipEvent = template.data.events.find(e => e.status_code === 'AC') || historyEvents[historyEvents.length - 1];
    const shipHoursDiff = Math.abs(shipEvent.hour_offset - mostRecentOffset);
    const shipDate = subHours(now, shipHoursDiff);

    // 5. Final Assembly
    const finalPayload = {
        resource_url: `https://api.shipengine.com/v1/tracking?carrier_code=${carrier}&tracking_number=${tracking_number}`,
        resource_type: "API_TRACK",
        data: {
            ...template.data,
            tracking_number: tracking_number,
            status_code: status,
            status_description: processedEvents[0].description,
            carrier_status_code: processedEvents[0].event_code,
            carrier_status_description: processedEvents[0].description,
            ship_date: formatISO(shipDate),
            actual_delivery_date: status === 'DE' ? formatISO(now) : null,
            events: processedEvents
        }
    };

    // 6. Push Webhook with ShipEngine Signature Headers
    try {
        console.log(`Pushing simulated ${status} to ${target_url}...`);
        
        await axios.post(target_url, finalPayload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'x-shipengine-rsa-sha256-key-id': 'simulated-key-123',
                'x-shipengine-rsa-sha256-signature': 'simulated-signature-v1',
                'x-shipengine-timestamp': formatISO(now)
            }
        });

        res.status(200).json({ message: "Simulation Successful", sent_payload: finalPayload });
    } catch (error) {
        console.error(`❌ Webhook Failed: ${error.message}`);
        res.status(500).json({ error: "Delivery failed", details: error.message });
    }
});

app.listen(3000, () => console.log('Simulator active on port 3000'));
