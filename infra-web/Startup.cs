using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace infra_web
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddHealthChecks(); // This registerd the service for heALTHCheck        }

        // This method then gets called by the runtime. used   to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILogger<Startup> logger)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseRouting();

            app.UseEndpoints(endpoints =>
            {
                // maps endpoint check requests
                endpoints.MapHealthChecks("/health");

                // 
                endpoints.MapGet("/", async context =>
                {
                    using var hc = new HttpClient();
                    using var apiResponse = await hc.GetAsync(Configuration["ApiAddress"]);
                    var apiResult = await apiResponse.Content.ReadAsStringAsync();
                    await context.Response.WriteAsync(apiResult);
                });
            });
        }
    }
}
