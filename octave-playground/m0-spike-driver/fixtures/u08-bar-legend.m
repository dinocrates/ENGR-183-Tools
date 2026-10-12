clear;
clc;
close all;

raw_data = readmatrix('solar_station_measurements.csv');

missing_measurement_rows = any(raw_data == -999, 2);
negative_voltage_or_current_rows = ...
    any(raw_data(:, [3 4 6 7 9 10]) < 0, 2);

valid_rows = ~missing_measurement_rows & ...
             ~negative_voltage_or_current_rows;
clean_data = raw_data(valid_rows, :);

retained_count = size(clean_data, 1);
test_day = clean_data(:, 1);
time_hr = clean_data(:, 2);
voltage_V = clean_data(:, [3 6 9]);
current_A = clean_data(:, [4 7 10]);

power_W = voltage_V .* current_A;
required_power_W = 100;
minimum_met_pct = 80;
system_names = {'A', 'B', 'C'};
selected_day = 1;

meeting_count = sum(power_W >= required_power_W);
met_pct = 100 * (meeting_count / retained_count);
disp(met_pct);

day_rows = test_day == selected_day;

figure(1);
plot(time_hr(day_rows), power_W(day_rows,1), ...
     '-o', 'LineWidth', 2);
hold on;
plot(time_hr(day_rows), power_W(day_rows,2), ...
     '--s', 'LineWidth', 2);
plot(time_hr(day_rows), power_W(day_rows,3), ...
     '-.o', 'LineWidth', 2);
plot([9 15], [required_power_W required_power_W], ...
     'k--', 'LineWidth', 1.5);
hold off;

xlabel('Time of Day (hour)');
ylabel('Power (Watts)');
ylim([80 220]);
grid on;
title('Comparing Power Output of Three Different Solar Panel Systems from 9am to 3pm');
legend('System A', 'System B', 'System C', ...
       'Required Power (100 W)', 'Location', 'northeast');

figure(2);
bar(1:3, met_pct);
hold on;
plot([0.5 3.5], [minimum_met_pct minimum_met_pct], ...
     'k--', 'LineWidth', 2);
title('Power Requirement Performance of Three Different Solar Panel Systems');
xlabel('Solar Panel System');
ylabel('Meeting Requirement (%)');
set(gca, 'XTick', 1:3, 'XTickLabel', system_names);
ylim([0 100]);
xlim([0.5 3.5]);
legend('Performance', 'Minimum Required (80%)', ...
       'Location', 'northwest');
grid on;
hold off;

disp('RENDER TEST COMPLETED');
