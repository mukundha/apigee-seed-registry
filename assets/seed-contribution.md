Kindly follow these guidelines to list your apiproxy/solution at Apigee Seed.

##### 1. Download proxy bundle from Apigee Edge

Download the desired proxy bundle from Apigee Edge and extract it. You should now have a folder named `apiproxy` with you.

##### 2. Write a Mocha test script

Create a new file called `test.js` and write a mocha testcase that demonstrates the behaviour of the proxy. Replace the URL that you are hitting with `__URL__`, this will help us to run your test script against
proxies that are deployed by other users in their orgs and env.

###### Some useful tips

 - Be Descriptive as much as possible
 - Supported modules - jQuery, async, chai (If you need support for more modules, Please contact mukundha@apigee.com or mviswanathan@apigee.com)

###### Testcase Example

    describe('Testing Quota Policy', function(){
     	describe('Calling ' + __URL__, function(){
     		it('Make 5 API calls, only 2 should succeed', function(done){
     			async.times(5, function(n, next){
     				jQuery.ajax({
     					url: url,
     					complete:function(xhr, statusText){
     					    next(null, xhr.status);
     					}
     				});
     			},function(cberror, codes){
     				var success_200 = 0
     				codes.forEach(
     				    function(code){
     				        if (code == 200)
     				            success_200++
     				    });
     				chai.assert.equal(2, success_200);
     				done(cberror);
     			})
     		})
     	})
     });

##### 3. Uploading to a Git Repo

Upload your proxy and test files to a public Git Repository. Follow this folder structure :

    /proxy-name
        -/apiproxy
        -/test.js

##### 4. Adding to Apigee Seed

Once you're done uploading the files to the Git repository, select Contribute in Apigee Seed. 
Make sure you have selected the correct Organization and Environment from which you downloaded the proxy from Apigee Edge on Step 1.

