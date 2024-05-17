using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices(services => {
        services.Configure<TelemetryConfiguration>(config => {
            var telemetryProcessChainBuilder = config.DefaultTelemetrySink.TelemetryProcessorChainBuilder;
            telemetryProcessChainBuilder.UseAdaptiveSampling(excludedTypes: "Request");
        });
        services.AddApplicationInsightsTelemetryWorkerService(x => {
            // Disable enabling adaptive sampling here, so the overrides above take place.
            x.EnableAdaptiveSampling = false;
        });
        services.ConfigureFunctionsApplicationInsights();
    })
    .Build();

host.Run();