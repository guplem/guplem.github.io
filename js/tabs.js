document.addEventListener('click', tabClick);

//Values must be ajusted using "ajustTabHeight()"
var tabs,// = document.querySelectorAll('.ProjectsTabs li a'),
    tabsContents,// = document.querySelectorAll('.ProjectsSection'),
    topHeight;// = 10;

function ajustTabHeight(){
    //alert("Going to adjust tab section height");

    tabs = document.querySelectorAll('.ProjectsTabs li a');
    tabsContents = document.querySelectorAll('.ProjectsSection');
    topHeight = 0;
    //console.log( document.querySelectorAll('.ProjectsSection'), document.querySelectorAll('.ProjectsSection').length)
    
    //alert("InitTabs with " + tabsContents.length + " tabs");
    
    
    for(var i= 0; i<tabsContents.length; i++){
    

        if (tabsContents[i].classList.contains("VisbleProject")) 
        {        
            // OLD 1 // tabsContents[i].style.position="relative";
            tabsContents[i].style.display = "block";

            if (tabsContents[i].offsetHeight>topHeight){
                topHeight = tabsContents[i].offsetHeight;
                //alert("TOP IS " + tabsContents[i].className);
            }

            //console.log(i, tabsContents[i].offsetHeight); //+ " className: " + tabsContents[i].className + " contents: " + tabsContents[i]);
            // OLD 2 // tabsContents[i].style.position="absolute";
        } else {
            tabsContents[i].style.display = "none";
        }
    }
    
    document.getElementById('ProjectsContainer').style.height=topHeight+"px";
    
    //console.log("ajustTabHeight to " + topHeight + "px");
    //alert("ajustTabHeight to " + topHeight + "px");
}



function tabClick(event){
    
    var elem = event.target;
        elemHREF = elem.getAttribute('href');
    
    
    if (elemHREF != null && elemHREF.indexOf('tab-') != -1){
        event.preventDefault();
        
        if(elem.className.lastIndexOf('activeTab') == -1){
            for (var i = 0; i < tabs.length; i++) {
                tabs[i].classList.remove('activeTab');
                tabsContents[i].classList.remove('VisbleProject');
            }
            
            elem.classList.add('activeTab');
            document.getElementById(elemHREF).classList.add('VisbleProject');
        }
        ajustTabHeight();
    } else {
        console.log("MEC");
        
        if (elemHREF == null) {
            //alert("click out of button");
            //ajustTabHeight();
        }
    }
}

